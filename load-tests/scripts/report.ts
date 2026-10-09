/**
 * Turns Artillery's raw JSON output into a readable Markdown report with a clear
 * PASS/FAIL verdict. scripts/run-test.ts calls this after every run; it can also
 * re-render an existing report:
 *
 *   npm run loadtest:report -- reports/baseline-<timestamp>.json
 *
 * Inputs: the Artillery JSON (`-o` output) plus the `<name>.meta.json` sidecar
 * run-test.ts writes next to it (tier, environment, target, resolved phases).
 *
 * Why this exists instead of reading Artillery's summary: Artillery's own
 * `maxErrorRate` is the VU-failure rate, so a run where most requests return
 * 4xx/429 can still "pass" it, and the summary never states actual concurrency.
 * This report gates on the HTTP-level error rate, measures concurrent sessions
 * from the 10s snapshots, and flags test-data/rate-limit problems that make a run
 * invalid rather than slow.
 */
import * as fs from "fs";
import * as path from "path";

// ─── Tier definitions ──────────────────────────────────────────────────────────

export interface TierProfile {
  title: string;
  /** Concurrent active sessions this tier is meant to hold during its steady phase. */
  intendedConcurrency?: number;
  p95?: number;
  p99?: number;
  /** Max share of requests that may fail (4xx/5xx/no response), percent. */
  maxHttpErrorRate: number;
  /** Max share of VUs that may fail, percent. */
  maxVuFailureRate: number;
  /** When false the tier is exploratory (stress/spike/soak): checks are reported, not gated. */
  gated: boolean;
}

export const TIER_PROFILES: Record<string, TierProfile> = {
  smoke: { title: "Smoke", p95: 1000, maxHttpErrorRate: 5, maxVuFailureRate: 5, gated: true },
  baseline: { title: "Baseline", intendedConcurrency: 50, p95: 500, p99: 1000, maxHttpErrorRate: 1, maxVuFailureRate: 1, gated: true },
  "normal-load": { title: "Normal load", p95: 500, p99: 1000, maxHttpErrorRate: 1, maxVuFailureRate: 1, gated: true },
  stress: { title: "Stress", maxHttpErrorRate: 1, maxVuFailureRate: 1, gated: false },
  spike: { title: "Spike", maxHttpErrorRate: 1, maxVuFailureRate: 1, gated: false },
  soak: { title: "Soak", p95: 500, p99: 1000, maxHttpErrorRate: 1, maxVuFailureRate: 1, gated: false },
  "order-lifecycle": { title: "Order lifecycle", p95: 1000, maxHttpErrorRate: 5, maxVuFailureRate: 5, gated: true },
  "concurrency-claim-race": { title: "Delivery claim race", maxHttpErrorRate: 100, maxVuFailureRate: 0, gated: true },
};

const CONCURRENCY_TOLERANCE = 0.2;

export interface Phase {
  name?: string;
  duration: number;
  arrivalRate?: number;
  rampTo?: number;
  arrivalCount?: number;
}

export interface RunMeta {
  tier: string;
  environment: string;
  target: string;
  phases: Phase[];
  startedAt: string;
  artilleryExitCode: number | null;
}

// ─── Artillery JSON shapes (only what we read) ─────────────────────────────────

interface Summary {
  min: number;
  max: number;
  count: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
}

interface Snapshot {
  counters: Record<string, number>;
  summaries: Record<string, Summary>;
  firstMetricAt?: number;
  lastMetricAt?: number;
  period?: number | string;
}

interface ArtilleryReport {
  aggregate: Snapshot;
  intermediate: Snapshot[];
}

// ─── Analysis ──────────────────────────────────────────────────────────────────

interface Check {
  name: string;
  target: string;
  actual: string;
  passed: boolean;
  /** Validity checks make the run meaningless when they fail (rate limiting, missing data). */
  kind: "performance" | "validity";
}

interface EndpointRow {
  name: string;
  requests: number;
  ok: number;
  failed: number;
  codes: Record<string, number>;
  latency?: Summary;
}

export interface Analysis {
  meta: RunMeta;
  profile: TierProfile;
  durationSec: number;
  vus: { created: number; completed: number; failed: number };
  concurrency: { avg: number; peak: number; littlesLaw: number | null; windowSec: number };
  requests: { total: number; responses: number; ok: number; failed: number; noResponse: number; errorRate: number; rps: number };
  latency?: Summary;
  statusCodes: Record<string, number>;
  rateLimited: number;
  endpoints: EndpointRow[];
  scenarios: Array<{ name: string; vus: number }>;
  vuErrors: Array<{ name: string; count: number }>;
  businessCounters: Array<{ name: string; count: number }>;
  checks: Check[];
  verdict: "PASS" | "FAIL";
  verdictReason: string;
  problems: string[];
  recommendations: string[];
}

const ENDPOINT_PREFIX = "plugins.metrics-by-endpoint.";

function sumCounters(counters: Record<string, number>, predicate: (k: string) => boolean): number {
  return Object.entries(counters).reduce((acc, [k, v]) => (predicate(k) ? acc + v : acc), 0);
}

function pct(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

function snapshotTime(s: Snapshot): number {
  return Number(s.period ?? s.firstMetricAt ?? 0);
}

/** Phases that make up the "steady" window: everything after a leading ramp, before any trailing ramp-down. */
function steadyWindow(phases: Phase[]): { startSec: number; endSec: number; rate: number | null } {
  let offset = 0;
  let start = 0;
  let end = phases.reduce((a, p) => a + p.duration, 0);
  let rate: number | null = null;
  phases.forEach((p, i) => {
    const isRamp = p.rampTo !== undefined && p.rampTo !== p.arrivalRate;
    if (isRamp && i === 0) start = offset + p.duration;
    if (!isRamp && p.arrivalRate !== undefined && rate === null) rate = p.arrivalRate;
    offset += p.duration;
  });
  // Ignore a trailing ramp (e.g. ramp-down) so it doesn't drag the average down.
  const last = phases[phases.length - 1];
  if (phases.length > 1 && last?.rampTo !== undefined && last.rampTo < (last.arrivalRate ?? 0)) end -= last.duration;
  return { startSec: start, endSec: end, rate };
}

const SNAPSHOT_MS = 10_000;

/**
 * Time-averaged concurrent sessions per 10s snapshot: total session time completed
 * in the window / window length (Little's law applied per window). Sampling the
 * in-flight count at window boundaries instead badly undercounts short sessions.
 * Sessions are attributed to the window they end in, which shifts the curve by at
 * most one session length - negligible over a multi-minute steady phase.
 */
function measureConcurrency(report: ArtilleryReport, meta: RunMeta, sessionMeanMs: number | undefined) {
  const snaps = [...report.intermediate].sort((a, b) => snapshotTime(a) - snapshotTime(b));
  const t0 = snaps.length ? snapshotTime(snaps[0]) : 0;
  const window = steadyWindow(meta.phases);

  const samples: number[] = [];
  let peak = 0;
  for (const s of snaps) {
    const sl = s.summaries?.["vusers.session_length"];
    const level = sl ? (sl.count * sl.mean) / SNAPSHOT_MS : 0;
    peak = Math.max(peak, level);
    const startOffset = (snapshotTime(s) - t0) / 1000;
    if (startOffset >= window.startSec && startOffset + SNAPSHOT_MS / 1000 <= window.endSec) samples.push(level);
  }
  const avg = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : 0;
  const littlesLaw = window.rate !== null && sessionMeanMs ? (window.rate * sessionMeanMs) / 1000 : null;
  return { avg, peak, littlesLaw, windowSec: (samples.length * SNAPSHOT_MS) / 1000 };
}

function endpointRows(agg: Snapshot): EndpointRow[] {
  const rows = new Map<string, EndpointRow>();
  const row = (name: string) => {
    if (!rows.has(name)) rows.set(name, { name, requests: 0, ok: 0, failed: 0, codes: {} });
    return rows.get(name)!;
  };
  for (const [k, v] of Object.entries(agg.counters)) {
    if (!k.startsWith(ENDPOINT_PREFIX)) continue;
    const m = k.slice(ENDPOINT_PREFIX.length).match(/^(.*)\.codes\.(\d{3})$/);
    if (!m) continue;
    const r = row(m[1]);
    r.codes[m[2]] = (r.codes[m[2]] || 0) + v;
    r.requests += v;
    if (Number(m[2]) < 400) r.ok += v;
    else r.failed += v;
  }
  for (const [k, v] of Object.entries(agg.summaries)) {
    if (!k.startsWith(`${ENDPOINT_PREFIX}response_time.`)) continue;
    row(k.slice(`${ENDPOINT_PREFIX}response_time.`.length)).latency = v;
  }
  return [...rows.values()].sort((a, b) => b.requests - a.requests);
}

const IGNORED_COUNTER_PREFIXES = ["http.", "vusers.", "errors.", "plugins.", "auth.register.response_time", "auth.login.response_time"];

export function analyze(report: ArtilleryReport, meta: RunMeta): Analysis {
  const profile = TIER_PROFILES[meta.tier] || { title: meta.tier, maxHttpErrorRate: 1, maxVuFailureRate: 1, gated: false };
  const agg = report.aggregate;
  const c = agg.counters || {};

  const durationSec = agg.firstMetricAt && agg.lastMetricAt ? (agg.lastMetricAt - agg.firstMetricAt) / 1000 : 0;
  const vus = { created: c["vusers.created"] || 0, completed: c["vusers.completed"] || 0, failed: c["vusers.failed"] || 0 };

  const statusCodes: Record<string, number> = {};
  for (const [k, v] of Object.entries(c)) {
    const m = k.match(/^http\.codes\.(\d{3})$/);
    if (m) statusCodes[m[1]] = v;
  }
  const total = c["http.requests"] || 0;
  const responses = c["http.responses"] || 0;
  const ok = sumCounters(statusCodes, (code) => Number(code) < 400);
  const noResponse = Math.max(0, total - responses);
  const failed = responses - ok + noResponse;
  const errorRate = pct(failed, total);
  const rps = durationSec > 0 ? total / durationSec : 0;
  const rateLimited = statusCodes["429"] || 0;

  const latency = agg.summaries?.["http.response_time"];
  const concurrency = measureConcurrency(report, meta, agg.summaries?.["vusers.session_length"]?.mean);

  const scenarios = Object.entries(c)
    .filter(([k]) => k.startsWith("vusers.created_by_name."))
    .map(([k, v]) => ({ name: k.slice("vusers.created_by_name.".length), vus: v }))
    .sort((a, b) => b.vus - a.vus);
  const vuErrors = Object.entries(c)
    .filter(([k]) => k.startsWith("errors."))
    .map(([k, v]) => ({ name: k.slice("errors.".length), count: v }))
    .sort((a, b) => b.count - a.count);
  const businessCounters = Object.entries(c)
    .filter(([k]) => !IGNORED_COUNTER_PREFIXES.some((p) => k.startsWith(p)))
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const skippedNoProduct = c["order.create.skipped_no_product"] || 0;

  // ── Checks ──
  const checks: Check[] = [];
  const fmtMs = (v: number | undefined) => (v === undefined ? "n/a" : `${v.toFixed(1)} ms`);
  if (profile.p95 !== undefined) {
    checks.push({ name: "p95 response time", target: `< ${profile.p95} ms`, actual: fmtMs(latency?.p95), passed: (latency?.p95 ?? Infinity) < profile.p95, kind: "performance" });
  }
  if (profile.p99 !== undefined) {
    checks.push({ name: "p99 response time", target: `< ${profile.p99} ms`, actual: fmtMs(latency?.p99), passed: (latency?.p99 ?? Infinity) < profile.p99, kind: "performance" });
  }
  checks.push({ name: "HTTP error rate", target: `< ${profile.maxHttpErrorRate}%`, actual: `${errorRate.toFixed(2)}%`, passed: errorRate < profile.maxHttpErrorRate || (profile.maxHttpErrorRate >= 100), kind: "performance" });
  const vuFailRate = pct(vus.failed, vus.created);
  checks.push({ name: "VU failure rate", target: profile.maxVuFailureRate === 0 ? "0%" : `< ${profile.maxVuFailureRate}%`, actual: `${vuFailRate.toFixed(2)}%`, passed: profile.maxVuFailureRate === 0 ? vus.failed === 0 : vuFailRate < profile.maxVuFailureRate, kind: "performance" });
  checks.push({ name: "Requests sent", target: "> 0", actual: String(total), passed: total > 0, kind: "validity" });
  checks.push({ name: "No rate limiting (429)", target: "0", actual: String(rateLimited), passed: rateLimited === 0, kind: "validity" });
  checks.push({ name: "Test data available (orders skipped)", target: "0", actual: String(skippedNoProduct), passed: skippedNoProduct === 0, kind: "validity" });
  if (profile.intendedConcurrency) {
    const lo = profile.intendedConcurrency * (1 - CONCURRENCY_TOLERANCE);
    const hi = profile.intendedConcurrency * (1 + CONCURRENCY_TOLERANCE);
    checks.push({
      name: "Concurrent sessions (steady avg)",
      target: `${lo.toFixed(0)}-${hi.toFixed(0)}`,
      actual: concurrency.avg.toFixed(1),
      passed: concurrency.avg >= lo && concurrency.avg <= hi,
      kind: "validity",
    });
  }

  const failedValidity = checks.filter((k) => k.kind === "validity" && !k.passed);
  const failedPerf = checks.filter((k) => k.kind === "performance" && !k.passed);
  let verdict: "PASS" | "FAIL" = "PASS";
  let verdictReason = "All thresholds met and the run is valid.";
  if (failedValidity.length) {
    verdict = "FAIL";
    verdictReason = `Run is not valid: ${failedValidity.map((k) => k.name).join(", ")}.`;
  } else if (failedPerf.length && profile.gated) {
    verdict = "FAIL";
    verdictReason = `Thresholds missed: ${failedPerf.map((k) => k.name).join(", ")}.`;
  } else if (failedPerf.length) {
    verdictReason = `Exploratory tier (not gated). Thresholds exceeded: ${failedPerf.map((k) => k.name).join(", ")}.`;
  } else if (meta.artilleryExitCode) {
    verdict = "FAIL";
    verdictReason = `Artillery exited with code ${meta.artilleryExitCode} (ensure/expect check failed).`;
  }

  const endpoints = endpointRows(agg);
  const { problems, recommendations } = diagnose({
    tier: meta.tier, profile, latency, endpoints, statusCodes, rateLimited, noResponse, vuErrors, skippedNoProduct,
    staleDeliveries: c["delivery.pending.stale_office_set"] || 0, concurrency, errorRate, total,
  });

  return {
    meta, profile, durationSec, vus, concurrency,
    requests: { total, responses, ok, failed, noResponse, errorRate, rps },
    latency, statusCodes, rateLimited, endpoints, scenarios, vuErrors, businessCounters,
    checks, verdict, verdictReason, problems, recommendations,
  };
}

const NEXT_TIER: Record<string, string> = { smoke: "baseline", baseline: "normal-load", "normal-load": "stress" };

function diagnose(x: {
  tier: string;
  profile: TierProfile;
  latency?: Summary;
  endpoints: EndpointRow[];
  statusCodes: Record<string, number>;
  rateLimited: number;
  noResponse: number;
  vuErrors: Array<{ name: string; count: number }>;
  skippedNoProduct: number;
  staleDeliveries: number;
  concurrency: Analysis["concurrency"];
  errorRate: number;
  total: number;
}) {
  const problems: string[] = [];
  const recs: string[] = [];

  if (x.total === 0) {
    problems.push("No HTTP requests were made - the target was unreachable or every VU failed before its first request.");
    recs.push("Check the stack is running (`curl <target-origin>/health`) and re-run.");
  }
  if (x.rateLimited > 0) {
    problems.push(`${x.rateLimited} requests were rate-limited (429). The run measured the limiter, not the services.`);
    recs.push("Run against an isolated load-test target (`npm run dev:loadtest` at the repo root, see docs/load-testing.md); never raise production limits for a test.");
  }
  if (x.skippedNoProduct > 0) {
    problems.push(`${x.skippedNoProduct} orders were skipped because no orderable product was available.`);
    recs.push("Re-seed against this target (`npm run loadtest:seed`) - vendor-products.csv is stale or stock ran out.");
  }
  const fiveXX = Object.entries(x.statusCodes).filter(([k]) => k.startsWith("5")).reduce((a, [, v]) => a + v, 0);
  if (fiveXX > 0) {
    problems.push(`${fiveXX} server errors (5xx).`);
    recs.push("Check the service logs for the endpoints with 5xx responses listed here (e.g. `Too many connections` = MySQL connection budget exhausted).");
  }
  if (x.noResponse > 0) {
    problems.push(`${x.noResponse} requests got no response (timeouts / connection errors).`);
  }
  for (const e of x.endpoints.filter((r) => r.failed > 0).sort((a, b) => b.failed - a.failed).slice(0, 5)) {
    const codes = Object.entries(e.codes).filter(([k]) => Number(k) >= 400).map(([k, v]) => `${v}x ${k}`).join(", ");
    problems.push(`\`${e.name}\` failed ${e.failed}/${e.requests} times (${codes}).`);
  }
  for (const e of x.vuErrors.slice(0, 5)) {
    const hint = e.name === "Failed capture or match" ? " - a required capture (usually the login accessToken) got no value, so the VU stopped" : "";
    problems.push(`VU error \`${e.name}\` x${e.count}${hint}.`);
  }
  if (x.staleDeliveries > 0) {
    problems.push(
      `Pending-delivery list returned ${x.staleDeliveries} rows (summed over calls) that are PENDING but already carry a delivery office - they can never be accepted. ` +
        "Cause: delivery-service's courier-assignment SLA revert does not clear delivery_office_id.",
    );
    recs.push("Fix `sla.worker.ts` handleAssignmentExpired so the revert actually nulls `delivery_office_id` (`deliveryRepo.update` skips undefined fields).");
  }
  if (x.profile.p95 !== undefined) {
    const slow = x.endpoints.filter((r) => r.latency && r.latency.p95 >= x.profile.p95!).sort((a, b) => b.latency!.p95 - a.latency!.p95);
    for (const e of slow.slice(0, 3)) problems.push(`\`${e.name}\` p95 is ${e.latency!.p95.toFixed(0)} ms (SLO ${x.profile.p95} ms).`);
    if (slow.length) recs.push("Profile the slow endpoints above (query plans / N+1 calls between services) before raising load.");
  }
  if (x.profile.intendedConcurrency) {
    const target = x.profile.intendedConcurrency;
    if (Math.abs(x.concurrency.avg - target) > target * CONCURRENCY_TOLERANCE) {
      problems.push(`Measured concurrency (${x.concurrency.avg.toFixed(1)}) is outside ${target} +/-${CONCURRENCY_TOLERANCE * 100}% - the test did not exercise the intended load.`);
      recs.push("Adjust arrivalRate (concurrency ~ arrivalRate x mean session length) or fix whatever is ending sessions early.");
    }
  }

  if (!problems.length) {
    problems.push("None found.");
    const slowest = [...x.endpoints].filter((r) => r.latency).sort((a, b) => b.latency!.p95 - a.latency!.p95)[0];
    if (slowest) recs.push(`Slowest endpoint is \`${slowest.name}\` (p95 ${slowest.latency!.p95.toFixed(0)} ms) - the first place to look as load increases.`);
    const next = NEXT_TIER[x.tier];
    recs.push(next ? `Run is valid - proceed to \`${next}\` and watch for where p95 and error rate start to climb.` : "Run is valid.");
  }
  return { problems, recommendations: [...new Set(recs)] };
}

// ─── Rendering ─────────────────────────────────────────────────────────────────

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m ? `${m}m ${s}s` : `${s}s`;
}

function fmtPhase(p: Phase): string {
  const label = p.name ? `${p.name}: ` : "";
  if (p.arrivalCount !== undefined) return `${label}${p.arrivalCount} VUs over ${p.duration}s`;
  if (p.rampTo !== undefined) return `${label}${p.duration}s, ${p.arrivalRate} -> ${p.rampTo} new sessions/s`;
  return `${label}${p.duration}s at ${p.arrivalRate} new sessions/s`;
}

const STATUS_MEANING: Record<string, string> = {
  "200": "OK", "201": "Created", "204": "No content", "304": "Not modified",
  "400": "Bad request / business rule", "401": "Unauthorized", "403": "Forbidden", "404": "Not found",
  "409": "Conflict", "422": "Validation", "429": "Rate limited", "500": "Server error", "502": "Bad gateway",
  "503": "Unavailable", "504": "Gateway timeout",
};

function table(headers: string[], rows: (string | number)[][], align?: ("l" | "r")[]): string {
  const sep = headers.map((_, i) => ((align?.[i] ?? "l") === "r" ? "---:" : "---"));
  return [`| ${headers.join(" | ")} |`, `| ${sep.join(" | ")} |`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
}

const ms = (v: number | undefined) => (v === undefined ? "-" : v.toFixed(0));

export function renderMarkdown(a: Analysis, rawPath: string): string {
  const icon = a.verdict === "PASS" ? "✅" : "❌";
  const out: string[] = [];
  out.push(`# ${a.profile.title} load test - ${icon} ${a.verdict}`);
  out.push("");
  out.push(`> **${a.verdict}** - ${a.verdictReason}`);
  out.push("");

  out.push("## 1. Test overview");
  out.push("");
  const concurrencyLine = a.profile.intendedConcurrency ? `~${a.profile.intendedConcurrency} concurrent sessions` : "n/a (not a fixed-concurrency tier)";
  out.push(table(["Item", "Value"], [
    ["Test / tier", `${a.profile.title} (\`${a.meta.tier}\`)`],
    ["Phases", a.meta.phases.map(fmtPhase).join("<br>")],
    ["Target environment", `\`${a.meta.environment}\` - ${a.meta.target}`],
    ["Started", a.meta.startedAt],
    ["Duration", fmtDuration(a.durationSec)],
    ["Intended concurrent users", concurrencyLine],
    ["Actual concurrent sessions", `avg **${a.concurrency.avg.toFixed(1)}** over the steady ${a.concurrency.windowSec}s, peak ${a.concurrency.peak.toFixed(1)} (10s windows)` +
      (a.concurrency.littlesLaw !== null ? ` (Little's law estimate: ${a.concurrency.littlesLaw.toFixed(1)})` : "")],
    ["Virtual users", `${a.vus.created} created / ${a.vus.completed} completed / ${a.vus.failed} failed`],
  ]));
  out.push("");

  out.push("## 2. Key results");
  out.push("");
  out.push(table(
    ["Total requests", "Successful", "Failed", "Error rate", "Requests/sec", "p50", "p95", "p99", "Max"],
    [[a.requests.total, a.requests.ok, a.requests.failed, `${a.requests.errorRate.toFixed(2)}%`, a.requests.rps.toFixed(1),
      `${ms(a.latency?.p50)} ms`, `${ms(a.latency?.p95)} ms`, `${ms(a.latency?.p99)} ms`, `${ms(a.latency?.max)} ms`]],
    ["r", "r", "r", "r", "r", "r", "r", "r", "r"],
  ));
  out.push("");
  out.push("Successful = 1xx-3xx responses. Failed = 4xx/5xx responses plus requests that got no response.");
  out.push("");

  out.push("## 3. Thresholds");
  out.push("");
  out.push(table(["Check", "Type", "Target", "Actual", "Result"], a.checks.map((k) => [k.name, k.kind, k.target, k.actual, k.passed ? "✅ pass" : "❌ fail"])));
  out.push("");
  if (!a.profile.gated) out.push("_This tier is exploratory: performance thresholds are reported but do not fail the run._\n");

  out.push("## 4. HTTP status breakdown");
  out.push("");
  const codeRows: (string | number)[][] = Object.entries(a.statusCodes)
    .sort(([x], [y]) => Number(x) - Number(y))
    .map(([code, n]) => [code, STATUS_MEANING[code] || "", n, `${pct(n, a.requests.total).toFixed(1)}%`]);
  if (a.requests.noResponse) codeRows.push(["-", "No response (timeout/connection error)", a.requests.noResponse, `${pct(a.requests.noResponse, a.requests.total).toFixed(1)}%`]);
  out.push(table(["Status", "Meaning", "Count", "Share"], codeRows, ["l", "l", "r", "r"]));
  out.push("");

  out.push("## 5. Endpoint breakdown");
  out.push("");
  out.push(table(
    ["Endpoint", "Requests", "OK", "Failed", "Error %", "p50 ms", "p95 ms", "p99 ms", "Max ms"],
    a.endpoints.map((e) => [`\`${e.name}\``, e.requests, e.ok, e.failed, `${pct(e.failed, e.requests).toFixed(1)}%`,
      ms(e.latency?.p50), ms(e.latency?.p95), ms(e.latency?.p99), ms(e.latency?.max)]),
    ["l", "r", "r", "r", "r", "r", "r", "r", "r"],
  ));
  out.push("");

  out.push("## 6. Scenario breakdown");
  out.push("");
  out.push(table(["Scenario", "VUs", "Share"], a.scenarios.map((s) => [s.name, s.vus, `${pct(s.vus, a.vus.created).toFixed(1)}%`]), ["l", "r", "r"]));
  out.push("");
  if (a.vuErrors.length) {
    out.push("**VU errors** (why VUs failed):");
    out.push("");
    out.push(table(["Error", "Count"], a.vuErrors.map((e) => [`\`${e.name}\``, e.count]), ["l", "r"]));
    out.push("");
  }
  if (a.businessCounters.length) {
    out.push("**Flow counters** (business outcomes emitted by processors/*.ts):");
    out.push("");
    out.push(table(["Counter", "Count"], a.businessCounters.map((b) => [`\`${b.name}\``, b.count]), ["l", "r"]));
    out.push("");
  }

  out.push("## 7. Bottlenecks / problems");
  out.push("");
  a.problems.forEach((p) => out.push(`- ${p}`));
  out.push("");

  out.push("## 8. Recommendations");
  out.push("");
  a.recommendations.forEach((r) => out.push(`- ${r}`));
  out.push("");

  out.push("---");
  out.push(`Raw Artillery output: \`${path.basename(rawPath)}\``);
  out.push("");
  return out.join("\n");
}

export function renderConsoleSummary(a: Analysis, mdPath: string): string {
  const line = "=".repeat(64);
  const rows = [
    line,
    ` ${a.profile.title.toUpperCase()} - ${a.verdict}   (${a.verdictReason})`,
    line,
    ` Target        ${a.meta.environment} - ${a.meta.target}`,
    ` Duration      ${fmtDuration(a.durationSec)}`,
    ` Concurrency   avg ${a.concurrency.avg.toFixed(1)}, peak ${a.concurrency.peak.toFixed(1)}` + (a.profile.intendedConcurrency ? ` (intended ~${a.profile.intendedConcurrency})` : ""),
    ` VUs           ${a.vus.created} created / ${a.vus.completed} completed / ${a.vus.failed} failed`,
    ` Requests      ${a.requests.total} total, ${a.requests.ok} ok, ${a.requests.failed} failed (${a.requests.errorRate.toFixed(2)}%), ${a.requests.rps.toFixed(1)} req/s`,
    ` Latency       p50 ${ms(a.latency?.p50)} ms, p95 ${ms(a.latency?.p95)} ms, p99 ${ms(a.latency?.p99)} ms`,
    ` Status codes  ${Object.entries(a.statusCodes).map(([k, v]) => `${k}:${v}`).join("  ") || "-"}`,
    "",
    ...a.checks.map((k) => ` ${k.passed ? "PASS" : "FAIL"}  ${k.name.padEnd(38)} ${k.actual} (target ${k.target})`),
    line,
    ` Report: ${mdPath}`,
    line,
  ];
  return rows.join("\n");
}

export function metaPathFor(jsonPath: string): string {
  return jsonPath.replace(/\.json$/, ".meta.json");
}

/** Reads `<report>.json` + its meta sidecar, writes `<report>.md`, returns the analysis. */
export function generateReport(jsonPath: string): { analysis: Analysis; mdPath: string } {
  const report: ArtilleryReport = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  const metaPath = metaPathFor(jsonPath);
  const tierGuess = path.basename(jsonPath).replace(/-\d{4}-\d{2}-\d{2}T.*$/, "");
  const meta: RunMeta = fs.existsSync(metaPath)
    ? JSON.parse(fs.readFileSync(metaPath, "utf-8"))
    : { tier: tierGuess, environment: "unknown", target: "unknown", phases: [], startedAt: "unknown", artilleryExitCode: null };
  const analysis = analyze(report, meta);
  const mdPath = jsonPath.replace(/\.json$/, ".md");
  fs.writeFileSync(mdPath, renderMarkdown(analysis, jsonPath));
  return { analysis, mdPath };
}

if (require.main === module) {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: ts-node scripts/report.ts reports/<tier>-<timestamp>.json");
    process.exit(1);
  }
  const { analysis, mdPath } = generateReport(path.resolve(process.cwd(), file));
  console.log(renderConsoleSummary(analysis, mdPath));
}

/**
 * Orchestrates a single Artillery run: resolves the target environment, enforces
 * the production safety guard (Phase 27), makes sure processors are loadable via
 * ts-node, and writes a timestamped JSON report under reports/.
 *
 * Usage (via package.json scripts, or directly):
 *   npm run loadtest:smoke
 *   npm run loadtest:stress -- --env local-nginx
 *   npm run loadtest:baseline -- --phases '[{"duration":600,"arrivalRate":10}]'
 *   ts-node scripts/run-test.ts scenarios/customer-browse.yml   (run any file directly)
 *
 * Every load profile (arrivalRate/duration/rampTo) has a sensible default baked
 * into the corresponding tests/*.yml, matching the example numbers from the task
 * brief for that tier. --phases overrides them wholesale with your own JSON array
 * via Artillery's native --overrides flag, rather than this script inventing a
 * separate per-tier env-var scheme - one mechanism, fully configurable.
 */
import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { env } from "./lib/env";
import { assertSafeToRun, isLocalTarget } from "./lib/safety";

const REPO_ROOT = path.resolve(__dirname, "..");
const ARTILLERY_BIN = path.resolve(REPO_ROOT, "node_modules/.bin/artillery");

const KNOWN_TIERS = ["smoke", "baseline", "normal-load", "stress", "spike", "soak", "order-lifecycle", "concurrency-claim-race"];

// These tiers provide only config (phases/thresholds) and rely on
// tests/_shared-scenarios.yml for their `scenarios:` array (see that file's
// header for why scenarios live in exactly one file). smoke/order-lifecycle/
// concurrency-claim-race are fully self-contained instead - merging
// _shared-scenarios.yml into those too would corrupt both scenario arrays
// (verified empirically: Artillery merges multiple files' `scenarios:` lists
// index-by-index, not by concatenating them).
const TIERS_USING_SHARED_SCENARIOS = ["baseline", "normal-load", "stress", "spike", "soak"];

function parseFlags(args: string[]) {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : "true";
      flags[key] = value;
    }
  }
  return flags;
}

function resolveTarget(environment: string): string {
  const envFilePath = path.join(REPO_ROOT, "config", "environments.yml");
  const content = fs.readFileSync(envFilePath, "utf-8");
  // Minimal, dependency-free extraction: environments.yml's structure is fixed and
  // simple enough (two-space-indented "name:\n  target: \"...\"") that a full YAML
  // parse isn't needed just to pre-flight the safety check below; Artillery itself
  // still does the real parsing when it loads the file.
  const re = new RegExp(`${environment}:\\s*\\n\\s*target:\\s*"([^"]+)"`);
  const match = content.match(re);
  return match ? match[1] : env.baseUrl;
}

function main() {
  const [, , tierArg, ...rest] = process.argv;
  if (!tierArg) {
    console.error(`Usage: ts-node scripts/run-test.ts <${KNOWN_TIERS.join("|")}|path/to/file.yml> [--env name] [--phases '[...]']`);
    process.exit(1);
  }

  const flags = parseFlags(rest);
  const environment = flags.env || "local";

  const isKnownTier = KNOWN_TIERS.includes(tierArg);
  const testFile = isKnownTier ? path.join(REPO_ROOT, "tests", `${tierArg}.yml`) : path.resolve(process.cwd(), tierArg);
  if (!fs.existsSync(testFile)) {
    console.error(`Test file not found: ${testFile}`);
    process.exit(1);
  }

  const target = flags.target || resolveTarget(environment);
  assertSafeToRun(target, tierArg);

  fs.mkdirSync(path.join(REPO_ROOT, "reports"), { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(REPO_ROOT, "reports", `${tierArg}-${timestamp}.json`);

  const artilleryArgs = ["run", "-e", environment];
  if (flags.target) artilleryArgs.push("-t", flags.target);
  if (flags.phases) {
    artilleryArgs.push("--overrides", JSON.stringify({ config: { phases: JSON.parse(flags.phases) } }));
  }
  artilleryArgs.push("-o", reportPath);
  artilleryArgs.push(path.join(REPO_ROOT, "config", "environments.yml"), testFile);
  if (TIERS_USING_SHARED_SCENARIOS.includes(tierArg)) {
    artilleryArgs.push(path.join(REPO_ROOT, "tests", "_shared-scenarios.yml"));
  }

  console.log(`\nRunning "${tierArg}" against [${environment}] ${target}`);
  console.log(`Report will be written to ${reportPath}\n`);
  if (!isLocalTarget(target)) {
    console.log("Reminder: this is not a local target - keep an eye on the infrastructure monitoring commands in README.md while this runs.\n");
  }

  const result = spawnSync(ARTILLERY_BIN, artilleryArgs, {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_OPTIONS: `${process.env.NODE_OPTIONS || ""} -r ts-node/register/transpile-only`.trim(),
    },
  });

  process.exit(result.status ?? 1);
}

main();

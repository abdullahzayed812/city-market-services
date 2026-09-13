import { env } from "./env";

/**
 * Phase 27 safety guard. api-gateway's routes/index.ts and nginx/nginx*.conf are
 * the only places a "production" host is meaningfully distinguished in this repo -
 * there is no committed staging environment (see config/environments.yml). This
 * check is intentionally conservative: it treats anything that is not an obvious
 * loopback/local address as requiring an explicit opt-in, rather than trying to
 * guess what "looks like production".
 */
const LOCAL_HOST_PATTERNS = [/^https?:\/\/localhost([:/]|$)/i, /^https?:\/\/127\.0\.0\.1([:/]|$)/i, /^https?:\/\/0\.0\.0\.0([:/]|$)/i];

export function isLocalTarget(targetUrl: string): boolean {
  return LOCAL_HOST_PATTERNS.some((re) => re.test(targetUrl));
}

export function assertSafeToRun(targetUrl: string, tierName: string): void {
  if (isLocalTarget(targetUrl)) return;

  if (!env.allowProductionLoadTest) {
    throw new Error(
      [
        `Refusing to run "${tierName}" against non-local target: ${targetUrl}`,
        `This does not look like localhost. If this really is an authorized staging`,
        `or production target, set ALLOW_PRODUCTION_LOAD_TEST=true in load-tests/.env`,
        `and re-run. Never enable this against production without explicit sign-off -`,
        `see README.md "Safety" section.`,
      ].join("\n"),
    );
  }

  // eslint-disable-next-line no-console
  console.warn(
    `\n⚠️  ALLOW_PRODUCTION_LOAD_TEST=true - running "${tierName}" against non-local target ${targetUrl}. ⚠️\n`,
  );
}

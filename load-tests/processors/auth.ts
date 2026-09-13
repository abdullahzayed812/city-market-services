/**
 * Authentication helpers for Artillery scenarios.
 *
 * Ground truth (verified against services/auth-service/src):
 * - POST /api/v1/auth/register  { email, password, role, deviceId, platform?, deviceName? }
 * - POST /api/v1/auth/login     { email, password, deviceId, platform?, deviceName? }
 *   -> { success, data: { accessToken, refreshToken, user }, message }
 * - Every device/session is single-active-per-user: auth.service.ts's login() calls
 *   sessionRepo.revokeAllForUser() before creating a new session. Logging in twice
 *   concurrently with the SAME account invalidates whichever session logged in first.
 *   Therefore every virtual user MUST authenticate as its own distinct account -
 *   never share one login across concurrent VUs (see README "Known limitations").
 * - UserRole enum (shared/src/enums/roles.ts): CUSTOMER, VENDOR, COURIER, ADMIN,
 *   DELIVERY_MANAGER. There is no "DELIVERY_OFFICE" role - delivery offices are a
 *   separate entity in delivery-service tied 1:1 to a DELIVERY_MANAGER user, and are
 *   NOT creatable through any API (DB-seed only) - see scripts/seed.ts.
 */

import { randomUUID } from "crypto";

const TEST_PASSWORD = process.env.SEED_ACCOUNTS_PASSWORD || "password123";
const APP_ID = "loadtest-artillery";

type ArtilleryContext = {
  vars: Record<string, any>;
};

type EventEmitter = {
  emit: (event: string, ...args: any[]) => void;
};

function randomSuffix(): string {
  return randomUUID().replace(/-/g, "").slice(0, 12);
}

/**
 * Builds a unique, clearly-identifiable load-test email for a given role.
 * Prefix is configurable via TEST_DATA_PREFIX so generated accounts are always
 * distinguishable from real users and safe to bulk-delete in cleanup.ts.
 */
export function loadTestEmail(rolePrefix: string): string {
  const prefix = process.env.TEST_DATA_PREFIX || "loadtest";
  return `${prefix}_${rolePrefix}_${randomSuffix()}@loadtest.local`;
}

/**
 * `function:` step - registers a brand-new CUSTOMER account and stores the
 * access token + userId on context.vars for use by later flow steps.
 * Used by scenarios/customer-*.yml and tests/*.yml customer flows.
 */
export async function registerCustomer(context: ArtilleryContext, events: EventEmitter): Promise<void> {
  await registerAs(context, events, "customer", "CUSTOMER");
}

/** Registers a brand-new VENDOR auth account (vendor profile is created separately). */
export async function registerVendor(context: ArtilleryContext, events: EventEmitter): Promise<void> {
  await registerAs(context, events, "vendor", "VENDOR");
}

/** Registers a brand-new COURIER auth account (courier profile is created separately, by an admin/office). */
export async function registerCourier(context: ArtilleryContext, events: EventEmitter): Promise<void> {
  await registerAs(context, events, "courier", "COURIER");
}

async function registerAs(
  context: ArtilleryContext,
  events: EventEmitter,
  rolePrefix: string,
  role: "CUSTOMER" | "VENDOR" | "COURIER",
): Promise<void> {
  const axios = require("axios");
  const baseUrl = context.vars.target || process.env.BASE_URL;
  const email = loadTestEmail(rolePrefix);
  const deviceId = randomUUID();

  const started = Date.now();
  try {
    const res = await axios.post(`${baseUrl}/auth/register`, {
      email,
      password: TEST_PASSWORD,
      role,
      deviceId,
      platform: "loadtest",
      appId: APP_ID,
    });

    const body = res.data?.data;
    context.vars.accessToken = body?.accessToken;
    context.vars.refreshToken = body?.refreshToken;
    context.vars.userId = body?.user?.id;
    context.vars.email = email;
    context.vars.deviceId = deviceId;
    // tests/order-lifecycle.yml role-plays as several accounts in one flow,
    // overwriting context.vars.accessToken each time it switches identity - stash
    // the customer's own token so the flow can switch back to it at the end
    // (see restoreCustomerToken below) without needing a second login call.
    if (rolePrefix === "customer") {
      context.vars.customerAccessToken = body?.accessToken;
    }
    events.emit("counter", `auth.register.${rolePrefix}.success`, 1);
    events.emit("histogram", "auth.register.response_time", Date.now() - started);
  } catch (err: any) {
    events.emit("counter", `auth.register.${rolePrefix}.failure`, 1);
    throw new Error(`register_failed(${rolePrefix}): ${err.response?.status || err.message}`);
  }
}

/** `function:` step - switches context.vars.accessToken back to the customer token stashed by registerCustomer, after the flow has role-played as other accounts. */
export async function restoreCustomerToken(context: ArtilleryContext): Promise<void> {
  if (context.vars.customerAccessToken) {
    context.vars.accessToken = context.vars.customerAccessToken;
  }
}

/**
 * `function:` step - logs in with a pre-seeded account (email/password supplied via
 * config.payload CSV, see data/README.md). Used for personas that cannot self-serve
 * an account through the API: DELIVERY_MANAGER (no delivery-office creation endpoint
 * exists) and any fixed courier accounts created ahead of time by scripts/seed.ts.
 *
 * IMPORTANT: because login is single-active-session-per-user, do not point two
 * concurrently-running virtual users at the same CSV row unless you accept that one
 * of them will be logged out mid-flow (see README "Known limitations").
 */
export async function loginFromPayload(context: ArtilleryContext, events: EventEmitter): Promise<void> {
  await loginWithCredentials(context, events, context.vars.email, context.vars.password || TEST_PASSWORD);
}

async function loginWithCredentials(
  context: ArtilleryContext,
  events: EventEmitter,
  email: string | undefined,
  password: string,
): Promise<void> {
  const axios = require("axios");
  const baseUrl = context.vars.target || process.env.BASE_URL;

  if (!email) {
    throw new Error("login: no email bound - check config.payload.fields or the -v flag");
  }

  const deviceId = randomUUID();
  const started = Date.now();
  try {
    const res = await axios.post(`${baseUrl}/auth/login`, {
      email,
      password,
      deviceId,
      platform: "loadtest",
      appId: APP_ID,
    });
    const body = res.data?.data;
    context.vars.accessToken = body?.accessToken;
    context.vars.userId = body?.user?.id;
    context.vars.deviceId = deviceId;
    events.emit("counter", "auth.login.success", 1);
    events.emit("histogram", "auth.login.response_time", Date.now() - started);
  } catch (err: any) {
    events.emit("counter", "auth.login.failure", 1);
    throw new Error(`login_failed(${email}): ${err.response?.status || err.message}`);
  }
}

/**
 * tests/_shared-scenarios.yml runs the Vendor, Delivery-office and Courier personas
 * side by side with the Customer ones in the same weighted mix, which means three
 * separate config.payload CSV pools (data/generated/{vendors,delivery-managers,couriers}.csv)
 * are loaded at once. Each pool uses distinctly-prefixed column names
 * (vendorEmail/officeEmail/courierEmail, etc.) specifically so they can't collide
 * into the same context.vars.email/password slot Artillery would otherwise bind -
 * these three wrappers just point the shared login logic at the right pool's columns
 * and copy its pre-existing profile id onto the common name later steps expect.
 */
export async function loginVendorFromPool(context: ArtilleryContext, events: EventEmitter): Promise<void> {
  await loginWithCredentials(context, events, context.vars.vendorEmail, context.vars.vendorPassword || TEST_PASSWORD);
  context.vars.vendorId = context.vars.vendorId || context.vars.poolVendorId;
}

export async function loginDeliveryManagerFromPool(context: ArtilleryContext, events: EventEmitter): Promise<void> {
  await loginWithCredentials(context, events, context.vars.officeEmail, context.vars.officePassword || TEST_PASSWORD);
}

export async function loginCourierFromPool(context: ArtilleryContext, events: EventEmitter): Promise<void> {
  await loginWithCredentials(context, events, context.vars.courierEmail, context.vars.courierPassword || TEST_PASSWORD);
  context.vars.courierId = context.vars.courierId || context.vars.poolCourierId;
}

/**
 * `beforeRequest` hook - attaches the bearer token captured by one of the functions
 * above onto every subsequent request in the flow.
 */
export async function attachAuthHeader(requestParams: any, context: ArtilleryContext): Promise<void> {
  if (!context.vars.accessToken) return;
  requestParams.headers = requestParams.headers || {};
  requestParams.headers["Authorization"] = `Bearer ${context.vars.accessToken}`;
}

import axios, { AxiosInstance } from "axios";
import { randomUUID } from "crypto";
import { env } from "./env";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Thin axios wrapper for the seed/cleanup/generate-users CLI scripts (not used by
 * Artillery scenarios - those go through processors/*.ts instead). Retries once on
 * 429 with a short backoff, since api-gateway's in-memory rate limiter and nginx's
 * `limit_req` zones (see README "Known limitations") are easy to trip when seeding
 * hundreds of accounts back-to-back from a single script.
 */
export function createApiClient(): AxiosInstance {
  return axios.create({ baseURL: env.baseUrl, timeout: 15000 });
}

export async function withRetry<T>(fn: () => Promise<T>, label: string, retries = 2): Promise<T> {
  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const status = err.response?.status;
      if (status === 429 && attempt < retries) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      throw new Error(`${label} failed: ${status || err.message} ${JSON.stringify(err.response?.data || {})}`);
    }
  }
  throw lastErr;
}

export interface RegisteredAccount {
  email: string;
  password: string;
  userId: string;
  accessToken: string;
}

export async function registerAccount(
  client: AxiosInstance,
  role: "CUSTOMER" | "VENDOR" | "COURIER",
  emailPrefix: string,
): Promise<RegisteredAccount> {
  const email = `${env.testDataPrefix}_${emailPrefix}_${randomUUID().slice(0, 8)}@loadtest.local`;
  const password = env.seedAccountsPassword;
  const res = await withRetry(
    () =>
      client.post("/auth/register", {
        email,
        password,
        role,
        deviceId: randomUUID(),
        platform: "loadtest-seed",
        appId: "loadtest-seed",
      }),
    `register(${role})`,
  );
  const data = res.data.data;
  return { email, password, userId: data.user.id, accessToken: data.accessToken };
}

export async function loginAccount(client: AxiosInstance, email: string, password: string): Promise<RegisteredAccount> {
  const res = await withRetry(
    () =>
      client.post("/auth/login", {
        email,
        password,
        deviceId: randomUUID(),
        platform: "loadtest-seed",
        appId: "loadtest-seed",
      }),
    `login(${email})`,
  );
  const data = res.data.data;
  return { email, password, userId: data.user.id, accessToken: data.accessToken };
}

export function authHeader(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

import "./env";
import { AddressInfo } from "net";
import express, { Router } from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "@city-market/shared";
import { authenticate, errorHandler } from "@city-market/shared/node";

export interface TestVendor {
  id: string;
  approvalStatus: string;
  isActive: boolean;
}

// vendor-service GET /me, answered from this map (by bearer token)
export const vendorsByToken = new Map<string, TestVendor>();

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : input.url;
  if (url === `${process.env.VENDOR_SERVICE_URL}/me`) {
    const auth = (init?.headers?.Authorization ?? init?.headers?.authorization ?? "") as string;
    const vendor = vendorsByToken.get(auth.replace("Bearer ", ""));
    return new Response(JSON.stringify(vendor ? { success: true, data: vendor } : { success: false }), {
      status: vendor ? 200 : 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  return realFetch(input, init);
}) as typeof fetch;

export const userToken = (userId: string, role: UserRole) =>
  jwt.sign({ userId, role, email: `${userId}@test` }, process.env.JWT_ACCESS_SECRET!, { expiresIn: "1h" });

export const serviceToken = (clientId = "admin-service") =>
  jwt.sign({ sub: clientId, scope: "internal", iss: "auth-service" }, process.env.JWT_SERVICE_ACCESS_SECRET!, { expiresIn: "1h" });

export async function startApp(...routers: Router[]) {
  const app = express();
  app.use(express.json());
  app.use(authenticate);
  for (const r of routers) app.use("/", r);
  app.use(errorHandler);
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const call = async (method: string, path: string, token?: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await realFetch(`${base}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json: any = await res.json().catch(() => null);
    return { status: res.status, body: json };
  };

  return { call, close: () => new Promise<void>((r) => server.close(() => r())) };
}

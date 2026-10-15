process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_SERVICE_ACCESS_SECRET = "test-service-secret";

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { AddressInfo } from "net";
import { randomBytes, randomUUID } from "crypto";
import express from "express";
import jwt from "jsonwebtoken";
import sharp from "sharp";
import { UserRole } from "@city-market/shared";
import { authenticate, errorHandler } from "@city-market/shared/node";
import { IPrivateStorageService, IStorageService, PrivateObjectInfo } from "../core/interfaces/storage.interface";
import { MediaService } from "../application/services/media.service";
import { ImageOptimizerService } from "../application/services/image-optimizer.service";
import { SubmissionImageService } from "../application/services/submission-image.service";
import { SubmissionImageController } from "../presentation/controllers/submission-image.controller";
import { createSubmissionImageRoutes } from "../presentation/routes/submission-image.routes";
import { createMediaRoutes } from "../presentation/routes/media.routes";
import { MediaController } from "../presentation/controllers/media.controller";

class MemoryPrivateStorage implements IPrivateStorageService {
  objects = new Map<string, { buffer: Buffer; metadata?: Record<string, string>; lastModified: Date }>();
  isConfigured() {
    return true;
  }
  async upload(buffer: Buffer, key: string, _type: string, metadata?: Record<string, string>) {
    this.objects.set(key, { buffer, metadata, lastModified: new Date() });
  }
  async get(key: string) {
    return this.objects.get(key)?.buffer ?? null;
  }
  async stat(key: string): Promise<PrivateObjectInfo | null> {
    const o = this.objects.get(key);
    return o ? { key, bytes: o.buffer.length, lastModified: o.lastModified, metadata: o.metadata } : null;
  }
  async delete(key: string) {
    this.objects.delete(key);
  }
  async list(prefix: string) {
    return Array.from(this.objects.entries())
      .filter(([k]) => k.startsWith(prefix))
      .map(([key, o]) => ({ key, bytes: o.buffer.length, lastModified: o.lastModified }));
  }
  async signedUrl(key: string, ttl: number) {
    return `https://private.example/${key}?X-Amz-Expires=${ttl}&X-Amz-Signature=secret`;
  }
}

class MemoryPublicStorage implements IStorageService {
  objects = new Map<string, Buffer>();
  async upload(buffer: Buffer, key: string) {
    this.objects.set(key, buffer);
    return { key, url: this.getPublicUrl(key) };
  }
  async delete(key: string) {
    this.objects.delete(key);
  }
  async deleteFolder(prefix: string) {
    for (const k of this.objects.keys()) if (k.startsWith(`${prefix}/`)) this.objects.delete(k);
  }
  getPublicUrl(key: string) {
    return `https://cdn.example/${key}`;
  }
}

const UPLOAD_LIMIT = 4;
const privateStorage = new MemoryPrivateStorage();
const publicStorage = new MemoryPublicStorage();
const mediaService = new MediaService(publicStorage, new ImageOptimizerService());
const service = new SubmissionImageService(
  privateStorage,
  mediaService,
  { formats: ["jpeg", "png", "webp"], minWidth: 800, minHeight: 800, maxBytes: 5 * 1024 * 1024, maxPixels: 40_000_000, outputMaxSide: 1600 },
  600,
);

const userToken = (userId: string, role: UserRole) => jwt.sign({ userId, role, email: "x@test" }, process.env.JWT_ACCESS_SECRET!);
const serviceToken = jwt.sign({ sub: "catalog-service-id", scope: "internal", iss: "auth-service" }, process.env.JWT_SERVICE_ACCESS_SECRET!);
const vendorUser = randomUUID();
const vendor = userToken(vendorUser, UserRole.VENDOR);
const otherVendor = userToken(randomUUID(), UserRole.VENDOR);

let base = "";
let close: () => Promise<void>;
before(async () => {
  const app = express();
  app.use(express.json());
  app.use(authenticate);
  app.use("/", createMediaRoutes(new MediaController(mediaService)));
  app.use("/", createSubmissionImageRoutes(new SubmissionImageController(service), { maxBytes: 5 * 1024 * 1024, uploadLimit: UPLOAD_LIMIT, uploadWindowMs: 60_000 }));
  app.use(errorHandler);
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => new Promise((r) => server.close(() => r()));
});
after(() => close());

const upload = async (token: string | null, file: Buffer, type: string, name = "photo.jpg") => {
  const form = new FormData();
  form.append("file", new Blob([file], { type }), name);
  const res = await fetch(`${base}/media/submission-images`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: form });
  return { status: res.status, body: (await res.json()) as any };
};

const json = async (method: string, path: string, token: string, body?: unknown) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as any };
};

const photo = (w = 1000, h = 900) => sharp({ create: { width: w, height: h, channels: 3, background: "#3a7" } }).jpeg().toBuffer();

describe("merchant upload", () => {
  test("shows the rules", async () => {
    const res = await json("GET", "/media/submission-images/rules", vendor);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, {
      formats: ["jpeg", "png", "webp"],
      mimeTypes: ["image/jpeg", "image/png", "image/webp"],
      minWidth: 800,
      minHeight: 800,
      maxBytes: 5 * 1024 * 1024,
    });
  });

  test("stores a valid photo privately under the uploader's id", async () => {
    const res = await upload(vendor, await photo(), "image/jpeg");
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.match(res.body.data.key, new RegExp(`^product-submissions/${vendorUser}/[0-9a-f-]{36}\\.webp$`));
    assert.equal(res.body.data.width, 1000);
    assert.equal(res.body.data.height, 900);
    assert.match(res.body.data.previewUrl, /^https:\/\/private\.example\//);
    assert.ok(privateStorage.objects.has(res.body.data.key));
    assert.equal(publicStorage.objects.size, 0, "nothing published");
  });

  test("rejects bad files with clear codes", async () => {
    const small = await upload(otherVendor, await photo(600, 600), "image/jpeg");
    assert.equal(small.status, 400);
    assert.equal(small.body.message, "image_too_small");
    const mismatch = await upload(otherVendor, await sharp({ create: { width: 900, height: 900, channels: 3, background: "#000" } }).png().toBuffer(), "image/jpeg");
    assert.equal(mismatch.body.message, "image_type_mismatch");
    const corrupt = await upload(otherVendor, Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), randomBytes(2000)]), "image/jpeg");
    assert.equal(corrupt.body.message, "image_corrupted");
  });

  test("files over 5 MB are refused by the upload limit", async () => {
    const big = Buffer.concat([await photo(), randomBytes(5 * 1024 * 1024)]);
    const res = await upload(userToken(randomUUID(), UserRole.VENDOR), big, "image/jpeg");
    assert.equal(res.status, 400);
    assert.equal(res.body.message, "image_too_large");
  });

  test("only merchants upload, and with a user token", async () => {
    assert.equal((await upload(null, await photo(), "image/jpeg")).status, 401);
    assert.equal((await upload(userToken(randomUUID(), UserRole.CUSTOMER), await photo(), "image/jpeg")).status, 401);
    assert.equal((await upload(userToken(randomUUID(), UserRole.ADMIN), await photo(), "image/jpeg")).status, 401);
    assert.equal((await upload(serviceToken, await photo(), "image/jpeg")).status, 403);
  });

  test("uploads are rate limited per merchant", async () => {
    const token = userToken(randomUUID(), UserRole.VENDOR);
    const file = await photo();
    const statuses: number[] = [];
    for (let i = 0; i < UPLOAD_LIMIT + 1; i++) statuses.push((await upload(token, file, "image/jpeg")).status);
    assert.deepEqual(statuses, [...Array(UPLOAD_LIMIT).fill(201), 429]);
    // Another merchant is not affected
    assert.equal((await upload(userToken(randomUUID(), UserRole.VENDOR), file, "image/jpeg")).status, 201);
  });
});

describe("private operations are for catalog-service only", () => {
  let key = "";
  before(async () => {
    key = (await upload(userToken(randomUUID(), UserRole.VENDOR), await photo(1200, 1000), "image/jpeg")).body.data.key;
  });

  test("merchants and admins can't stat, sign, publish, list or delete", async () => {
    for (const token of [vendor, userToken(randomUUID(), UserRole.ADMIN)]) {
      assert.equal((await json("POST", "/media/private/stat", token, { key })).status, 403);
      assert.equal((await json("POST", "/media/private/signed-urls", token, { keys: [key] })).status, 403);
      assert.equal((await json("POST", "/media/private/promote", token, { key, folder: "globals", entityId: randomUUID() })).status, 403);
      assert.equal((await json("POST", "/media/private/list", token, {})).status, 403);
      assert.equal((await json("DELETE", "/media/private", token, { key })).status, 403);
    }
    // Nor through the generic delete endpoint
    assert.equal((await json("DELETE", "/media/file", vendor, { key })).status, 403);
    assert.ok(privateStorage.objects.has(key));
  });

  test("stat and signed URLs", async () => {
    const stat = await json("POST", "/media/private/stat", serviceToken, { key });
    assert.deepEqual({ exists: stat.body.data.exists, width: stat.body.data.width, height: stat.body.data.height }, { exists: true, width: 1200, height: 1000 });
    const missing = await json("POST", "/media/private/stat", serviceToken, { key: `product-submissions/${randomUUID()}/${randomUUID()}.webp` });
    assert.equal(missing.body.data.exists, false);
    const urls = await json("POST", "/media/private/signed-urls", serviceToken, { keys: [key] });
    assert.match(urls.body.data.urls[key], /X-Amz-Expires=600/);
  });

  test("only proposal keys are accepted", async () => {
    for (const bad of ["globals/x/large.webp", "../etc/passwd", "product-submissions/../../x", ""]) {
      const res = await json("POST", "/media/private/stat", serviceToken, { key: bad });
      assert.equal(res.status, 400, bad);
    }
  });

  test("promote publishes to the catalog path and can be repeated", async () => {
    const entityId = randomUUID();
    const first = await json("POST", "/media/private/promote", serviceToken, { key, folder: "globals", entityId });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    assert.equal(first.body.data.url, `https://cdn.example/globals/${entityId}/large.webp`);
    const again = await json("POST", "/media/private/promote", serviceToken, { key, folder: "globals", entityId });
    assert.equal(again.body.data.url, first.body.data.url);
    assert.equal(Array.from(publicStorage.objects.keys()).filter((k) => k.includes(entityId)).length, 1);
    const missing = await json("POST", "/media/private/promote", serviceToken, {
      key: `product-submissions/${randomUUID()}/${randomUUID()}.webp`,
      folder: "globals",
      entityId: randomUUID(),
    });
    assert.equal(missing.status, 404);
    assert.equal(missing.body.message, "submission_image_missing");
  });

  test("list and delete", async () => {
    const listed = await json("POST", "/media/private/list", serviceToken, { olderThanSeconds: 0 });
    assert.ok(listed.body.data.keys.length >= 1);
    const fresh = await json("POST", "/media/private/list", serviceToken, { olderThanSeconds: 3600 });
    assert.equal(fresh.body.data.keys.length, 0, "nothing is older than an hour");
    assert.equal((await json("DELETE", "/media/private", serviceToken, { key })).status, 200);
    assert.equal(privateStorage.objects.has(key), false);
  });
});

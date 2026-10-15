import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import { S3Client, CreateBucketCommand } from "@aws-sdk/client-s3";
import { R2PrivateStorageService } from "../infrastructure/storage/r2-private-storage.service";

// Against a real S3-compatible server (e.g. a throwaway MinIO). Skipped unless
// MEDIA_TEST_S3_ENDPOINT / _KEY / _SECRET are set.
const endpoint = process.env.MEDIA_TEST_S3_ENDPOINT;
const credentials = { accessKeyId: process.env.MEDIA_TEST_S3_KEY ?? "", secretAccessKey: process.env.MEDIA_TEST_S3_SECRET ?? "" };
const bucket = `private-${randomUUID().slice(0, 8)}`;

describe("private storage on S3", { skip: !endpoint && "set MEDIA_TEST_S3_ENDPOINT to run" }, () => {
  let storage: R2PrivateStorageService;
  const key = `product-submissions/${randomUUID()}/${randomUUID()}.webp`;
  const body = Buffer.from("RIFF....WEBPVP8 fake image bytes");

  before(async () => {
    const client = new S3Client({ region: "us-east-1", endpoint, credentials, forcePathStyle: true });
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    storage = new R2PrivateStorageService({ endpoint: endpoint!, ...credentials, bucket, forcePathStyle: true });
  });

  test("upload, stat with metadata, get, list", async () => {
    await storage.upload(body, key, "image/webp", { width: "1200", height: "900" });
    const info = await storage.stat(key);
    assert.equal(info?.bytes, body.length);
    assert.deepEqual(info?.metadata, { width: "1200", height: "900" });
    assert.deepEqual(await storage.get(key), body);
    assert.equal(await storage.stat(`${key}.missing`), null);
    assert.equal(await storage.get(`${key}.missing`), null);
    const listed = await storage.list("product-submissions/", 100);
    assert.ok(listed.some((o) => o.key === key));
  });

  test("the object is only readable through a signed URL", async () => {
    const signed = await storage.signedUrl(key, 60);
    const ok = await fetch(signed);
    assert.equal(ok.status, 200);
    assert.deepEqual(Buffer.from(await ok.arrayBuffer()), body);

    const unsigned = await fetch(`${endpoint}/${bucket}/${key}`);
    assert.equal(unsigned.status, 403);

    const tampered = signed.replace(key, key.replace(/\.webp$/, "x.webp"));
    assert.equal((await fetch(tampered)).status, 403);
  });

  test("delete", async () => {
    await storage.delete(key);
    assert.equal(await storage.stat(key), null);
  });

  test("not configured -> 503", async () => {
    const off = new R2PrivateStorageService({ endpoint: endpoint!, ...credentials, bucket: "" });
    assert.equal(off.isConfigured(), false);
    await assert.rejects(off.upload(body, key, "image/webp"), (e: any) => e.statusCode === 503 && e.message === "private_storage_not_configured");
  });
});

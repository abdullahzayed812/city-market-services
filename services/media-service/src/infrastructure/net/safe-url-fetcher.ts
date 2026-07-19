import dns from "dns/promises";
import net from "net";
import { ValidationError } from "@city-market/shared";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024; // matches media.service.ts multipart upload limit
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

// Blocks loopback/private/link-local ranges so an admin-supplied CSV image URL
// can't be used to make this service reach internal hosts (e.g. cloud metadata
// endpoints, other containers on the docker network).
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // fc00::/7 ULA
    if (/^fe[89ab]/.test(normalized)) return true; // fe80::/10 link-local
    if (normalized.startsWith("::ffff:")) return isPrivateIp(normalized.slice(7));
    return false;
  }
  return true; // unrecognized format — fail closed
}

async function assertPublicHost(hostname: string): Promise<void> {
  let addresses: string[];
  try {
    addresses = (await dns.lookup(hostname, { all: true })).map((r) => r.address);
  } catch {
    throw new ValidationError("could_not_resolve_image_host");
  }
  if (addresses.length === 0 || addresses.some(isPrivateIp)) {
    throw new ValidationError("image_url_not_allowed");
  }
}

async function fetchFollowingRedirects(url: URL, signal: AbortSignal, hopsLeft = MAX_REDIRECTS): Promise<Response> {
  const response = await fetch(url, { signal, redirect: "manual" });

  if (response.status >= 300 && response.status < 400) {
    if (hopsLeft <= 0) throw new ValidationError("too_many_redirects");

    const location = response.headers.get("location");
    if (!location) throw new ValidationError("failed_to_download_image");

    const nextUrl = new URL(location, url);
    if (!ALLOWED_PROTOCOLS.has(nextUrl.protocol)) throw new ValidationError("invalid_image_url_protocol");
    await assertPublicHost(nextUrl.hostname);

    return fetchFollowingRedirects(nextUrl, signal, hopsLeft - 1);
  }

  return response;
}

export interface FetchedImage {
  buffer: Buffer;
  contentType: string;
}

export async function fetchImageFromUrl(rawUrl: string): Promise<FetchedImage> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ValidationError("invalid_image_url");
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new ValidationError("invalid_image_url_protocol");
  }

  await assertPublicHost(url.hostname);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetchFollowingRedirects(url, controller.signal);
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError("failed_to_download_image");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new ValidationError("failed_to_download_image");
  }

  const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || "";
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new ValidationError("invalid_image_content_type");
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_DOWNLOAD_BYTES) {
    throw new ValidationError("image_too_large");
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_DOWNLOAD_BYTES) {
    throw new ValidationError("image_too_large");
  }

  return { buffer: Buffer.from(arrayBuffer), contentType };
}

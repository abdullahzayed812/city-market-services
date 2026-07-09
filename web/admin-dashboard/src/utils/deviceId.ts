const DEVICE_ID_KEY = "device_id";

// crypto.randomUUID() only exists in secure contexts (HTTPS, or localhost).
// Served over plain HTTP on a real domain, it's undefined and throws — fall
// back to a manual UUID v4 so login still works before HTTPS is set up.
function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// A device id is not a secret (unlike auth tokens) — it's fine to persist
// in localStorage so the same browser is recognized across sessions.
export function getOrCreateDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = generateUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

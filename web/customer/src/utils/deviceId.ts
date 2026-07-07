const DEVICE_ID_KEY = 'device_id';

// A device id is not a secret (unlike auth tokens) — it's fine to persist
// in localStorage so the same browser is recognized across sessions.
export function getOrCreateDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

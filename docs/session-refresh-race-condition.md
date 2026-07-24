# Session Refresh Race Condition — Forced Re-login Bug

This document describes a bug where logged-in users on the web apps were forced to
log in again after being idle for a few minutes, or after closing and reopening the
browser window, along with the root cause and the fix applied.

## 1. Symptom

Users of the web apps (customer, admin, vendor, delivery dashboards) would
occasionally get signed out and redirected to the login page:

- After leaving a tab idle for a few minutes and coming back to it.
- After closing the browser window/tab and reopening the app later.

The failure did not correlate cleanly with idle time — it was really a delayed
symptom of an earlier, silent session-kill event (see below).

## 2. Background: how web auth is designed

- **Access tokens** are short-lived (15 min by default, `JWT_ACCESS_EXPIRY` in
  `services/auth-service/src/config/env.ts`) and kept **in JS memory only** on the
  web apps — never `localStorage`/`sessionStorage` — to reduce XSS blast radius.
- **Refresh tokens** are long-lived (30 days by default, `JWT_REFRESH_EXPIRY`) and
  stored exclusively in an `httpOnly` cookie set by the backend
  (`services/auth-service/src/presentation/controllers/auth.controller.ts`,
  `setTokenCookies`).
- Because the access token lives only in memory, every hard reload or reopened tab
  loses it. Each web app re-establishes one on boot by silently calling
  `POST /auth/refresh` (the `silentRefresh()` helper in each app's API client),
  relying on the browser automatically attaching the `httpOnly` refresh cookie.
- The backend uses **rotating refresh tokens with reuse detection**
  (`services/auth-service/src/application/services/auth.service.ts`,
  `refreshToken()`): every call to `/auth/refresh` invalidates the current refresh
  token and issues a brand new one. If the *old* (already-rotated) token is ever
  presented again, the backend assumes it has been stolen and replayed, and revokes
  **every session for that user** (`sessionRepo.revokeAllForUser(..., "reuse_detected")`).

Both of these are reasonable, intentional security choices in isolation. The bug was
in how they interacted.

## 3. Root cause

The bootstrap effect that calls `silentRefresh()` on app load had no protection
against being invoked more than once with the same (not-yet-rotated) refresh
cookie. This happened in two ways:

1. **React `<StrictMode>` double-invocation (dev).** All four web apps wrap the
   app tree in `<StrictMode>` (e.g. `web/customer/src/main.tsx`). In development,
   StrictMode deliberately double-invokes mount effects. The bootstrap effect
   (`useAuthBootstrap` in `web/customer/src/app/Router.tsx`, and the equivalent
   `AuthProvider.tsx` effect in the admin/vendor/delivery dashboards) called
   `silentRefresh()` directly inside a plain `useEffect`, so it fired **twice**
   back-to-back:
   - Call 1 reads the current refresh cookie, rotates it in the DB, and succeeds.
   - Call 2 reads the *same* (now stale) cookie value — the browser hadn't applied
     call 1's `Set-Cookie` yet when call 2's request was already in flight — and
     gets rejected as a token replay, which triggers `revokeAllForUser(...,
     "reuse_detected")`. This kills the session call 1 had just legitimately
     created.

2. **Multiple browser tabs (dev or prod).** The refresh-token cookie is shared
   across all tabs for the same origin. If two tabs both attempt a refresh around
   the same time (e.g. tabs restored on browser reopen, or two tabs whose access
   tokens happen to expire close together), the same race plays out: whichever
   request reaches the backend second presents an already-rotated token and trips
   the reuse-detection kill switch. The per-tab `isRefreshing` guard in each app's
   API client (`apiClient.ts` / `axios-instance.ts` / `client.ts`) only prevents
   concurrent refreshes *within a single tab* — it has no visibility into other
   tabs.

Because a killed session is revoked in the database, not just the current request,
the failure often did not surface immediately. The next time *any* tab tried to use
or refresh that session — sometimes much later, on what looked like an ordinary
reload — the refresh call would fail with `session_expired_or_revoked`, forcing a
full re-login. This is why the bug presented as "idle for a few minutes" or "closed
and reopened the window" rather than an obvious, immediate crash.

## 4. Fix

Two complementary changes, one per layer:

### 4.1 Backend: grace window for benign refresh races

`services/auth-service/src/application/services/auth.service.ts`,
`refreshToken()`:

- If the presented token doesn't match the *current* refresh-token hash, the
  service now checks whether it matches the **immediately-previous** hash *and*
  whether that rotation happened within the last 10 seconds
  (`REFRESH_REUSE_GRACE_MS`).
- If so, it's treated as a benign concurrent-request race (duplicate mount effect,
  second tab, etc.): the caller is resynced onto the current session and the token
  is rotated again, instead of revoking anything.
- If the stale token is presented **outside** that window, the original behavior is
  unchanged — it's treated as a genuine replay and every session for that user is
  revoked. Real reuse/theft detection is not weakened; only the false-positive
  window around a legitimate double-call is closed.

### 4.2 Frontend: dedupe concurrent silent refreshes

In each web app's API client (`web/customer/src/services/api/apiClient.ts`,
`web/admin-dashboard/src/services/api/axios-instance.ts`,
`web/vendor-dashboard/src/services/api/client.ts`,
`web/delivery-dashboard/src/services/api/client.ts`), `silentRefresh()` now
memoizes its in-flight request:

```ts
let silentRefreshPromise: Promise<{ accessToken: string; user: unknown } | null> | null = null;

export const silentRefresh = (): Promise<{ accessToken: string; user: unknown } | null> => {
  if (silentRefreshPromise) return silentRefreshPromise;

  silentRefreshPromise = (async () => {
    try {
      // ...POST /auth/refresh...
    } finally {
      silentRefreshPromise = null;
    }
  })();

  return silentRefreshPromise;
};
```

A second call made while one is already in flight (e.g. StrictMode's second mount)
receives the same promise instead of firing a second HTTP request, so the same-tab
race no longer reaches the network at all. This does not (and cannot) solve the
cross-tab case on its own, since each tab has its own JS module state — that's
what the backend grace window covers.

## 5. Mobile apps: audited, not affected

All four React Native apps (`mobile/Customer`, `mobile/Vendor`, `mobile/Courier`,
`mobile/Delivery`) share an identical `apiClient.ts` / `AuthContext.tsx`
structure and were checked for the same class of bug. They are not exposed to it:

- **No refresh call on bootstrap.** `AuthContext.tsx` reads the already-persisted
  access token straight out of `SecureStorage` on launch and never calls
  `/auth/refresh` at startup — there is no duplicate-call race to trigger in the
  first place.
- **Refresh is purely reactive**, triggered only by an actual `401` inside the
  axios response interceptor, guarded by a synchronous `isRefreshing` flag with no
  `await` gap between the check and the set — safe against concurrent 401s within
  the app process.
- Each `authService.ts` defines a standalone `refresh()` method, but a repo-wide
  search confirmed it is **never called** outside its own definition — dead code,
  not wired to any app-resume/foreground listener, so it cannot race against the
  interceptor's refresh path.

No mobile-side changes were made. They still benefit from the backend grace-window
fix as defense-in-depth, since it applies at the endpoint level regardless of
client.

## 6. Related, unrelated behavior: single active device per user

Separately from this bug, the backend intentionally enforces **one active session
per user across all devices**: logging in anywhere (a new device, a different
browser, a mobile app reinstall) revokes every other session for that account
(`sessionRepo.revokeAllForUser(user.id, "new_login_single_device")` in `login()`).
This is by design, not a bug, but it is another realistic reason a user might find
themselves logged out elsewhere and worth ruling out when triaging future reports
that look similar to this one.

## 7. Files changed

- `services/auth-service/src/application/services/auth.service.ts`
- `web/customer/src/services/api/apiClient.ts`
- `web/admin-dashboard/src/services/api/axios-instance.ts`
- `web/vendor-dashboard/src/services/api/client.ts`
- `web/delivery-dashboard/src/services/api/client.ts`

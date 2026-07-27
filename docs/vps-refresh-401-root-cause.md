# VPS-Only Refresh Token 401 — Root Cause Analysis

## Symptom

- Works locally (`npm run dev` and local Docker Compose): login, refresh, page
  reload, and session restoration all succeed.
- On the VPS: login succeeds and the app is usable within the same tab, but
  refreshing the page (F5), reopening the app, or opening it in a new tab
  logs the user out. The `/auth/refresh` call returns **401 Unauthorized**.

## Auth lifecycle (as implemented)

1. **Login** (`services/auth-service/src/presentation/controllers/auth.controller.ts:81-91`)
   sets `access_token_<appId>` / `refresh_token_<appId>` httpOnly cookies and
   *also* returns both tokens in the JSON response body.
2. **Client** (`web/customer/src/services/api/apiClient.ts:17-21`) keeps the
   access token in a JS variable only — never in `localStorage`. Session
   restoration after a reload depends entirely on the httpOnly refresh
   cookie being sent back automatically (`withCredentials: true`).
3. **Reload / new tab**: the in-memory access token is gone by design.
   `useAuthBootstrap()` (`web/customer/src/app/Router.tsx:63-75`) calls
   `silentRefresh()`, which POSTs to `/auth/refresh` expecting the browser
   to attach the refresh cookie on its own.
4. On the VPS, that cookie was **never stored by the browser in the first
   place**.

## Root cause

`auth.controller.ts:25-34`:

```ts
const isProduction = process.env.NODE_ENV === "production";
res.cookie(access, tokens.accessToken, {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "strict" : "lax",
  ...
});
```

`Dockerfile.service:55` bakes `ENV NODE_ENV=production` into **every**
service image unconditionally, regardless of where it runs. So
`isProduction` is `true` any time the app runs inside this Docker image —
local Docker Compose included — and the cookies get `Secure: true`.

Browsers silently refuse to store a `Secure` cookie set over a plain-HTTP
response, with one exception: `localhost` / `127.0.0.1` are treated as
secure contexts even over HTTP.

- **Local Docker Compose**: browser hits `http://localhost:8080/...` → the
  `localhost` exception applies → the `Secure` cookie is stored anyway →
  works.
- **`npm run dev`**: also `localhost`, and typically not even running the
  production Docker image — masks the bug two different ways.
- **VPS**: the browser hits the VPS over its real domain or IP.
  `DEPLOYMENT.md` §4 explicitly does an **"HTTP only" first deploy** via
  `./scripts/deploy.sh` with no flags — SSL is a separate, manual, opt-in
  step (`--ssl`, §6). If SSL hasn't been enabled yet (or the site is being
  reached over `http://` for any other reason), the response to `/login`
  sets `Set-Cookie: refresh_token_customer-web=...; Secure`, and the
  browser drops it without any visible error. DevTools →
  Application → Cookies would show **no refresh cookie at all** right
  after login.

This explains every observed symptom:

- Login "succeeds" — success is judged from the JSON body / in-memory
  access token, not the cookie.
- Protected pages work within the same tab — the access token is still
  alive in JS memory.
- Reload / new tab / reopen — memory is wiped, `silentRefresh()` fires, no
  cookie was ever sent (because none was ever stored), and the backend
  correctly reports `no_refresh_token_provided` → 401.
- It cannot reproduce locally, because `localhost` gets a free pass on the
  `Secure` requirement that the VPS's real hostname doesn't get.

## Confidence ranking

1. **Very high confidence** — `secure: isProduction` conflates "is this a
   production build" with "is this specific connection HTTPS." Combined
   with the VPS most likely still being on the default HTTP-only deploy
   path from `DEPLOYMENT.md`, this silently drops both cookies. This alone
   reproduces the entire bug report.
2. **Secondary, worth fixing regardless** — `sameSite: isProduction ?
   "strict" : "lax"`. Currently harmless because `admin/vendor/
   delivery.citymarket.tech` are same-site with `citymarket.tech` (same
   registrable domain), so `Strict` still allows the cross-subdomain XHR.
   But it's unnecessarily fragile: it breaks the moment the API is reached
   via a different registrable domain (raw VPS IP, a different apex
   domain, a tunnel/proxy service), and `Strict` cookies aren't even sent
   on top-level cross-site navigation, which `Lax` handles fine. `Lax` is
   sufficient for this first-party XHR-only flow.
3. **Low likelihood, worth a 10-second check** — if `VITE_API_URL` /
   `VITE_API_BASE_URL` were left at their default
   `http://localhost/api/v1` on the VPS build, every request (not just
   refresh) would fail. Since login and other API calls work, this is
   almost certainly already set correctly — confirm via the Network tab or
   by grepping the built JS bundle for `VITE_API`.

## Verification steps (before patching)

- `curl -I http://yourdomain.com` (or the IP) — does it 301 to HTTPS, or
  serve the app directly over HTTP?
- Log in, then DevTools → Application → Cookies — is
  `refresh_token_customer-web` present at all? (Prediction: **no**, if
  accessed over HTTP.)
- Network tab on the `/auth/login` response — does `Set-Cookie` include
  `Secure`? (It will, unconditionally, since it isn't gated on the
  request's actual scheme.)
- `docker compose exec auth-service env | grep NODE_ENV` — confirms it
  reads `production` regardless of whether SSL is actually enabled.

## Fix applied

Two independent fixes, one infra and one code:

1. **Infra**: enable SSL on the VPS — `./scripts/deploy.sh --ssl` (or the
   manual switch in `DEPLOYMENT.md` §6) once DNS points at the VPS. If the
   deploy was still on the default HTTP-only path, this alone resolves the
   symptom, since the old `secure: isProduction` code would then match
   reality (`isProduction` true + connection actually HTTPS).
2. **Code** (`services/auth-service/src/presentation/controllers/auth.controller.ts`):
   `setTokenCookies` no longer gates `secure` on `NODE_ENV`. It now takes
   `req` and uses `req.secure` (which respects `trust proxy` +
   `X-Forwarded-Proto`, already set in `app.ts:17`), so the cookie's
   `Secure` attribute matches the actual connection instead of the build
   mode. `sameSite` was also simplified to `"lax"` unconditionally — this
   flow is first-party XHR only, so `Strict` bought nothing but fragility
   (see confidence-ranking point 2 above). All three call sites (register,
   login, refresh) were updated to pass `req` through.

This makes the cookie policy correct on both HTTP-first deploys and
HTTPS deploys, and removes the dependency on `NODE_ENV` as a (wrong) proxy
for transport security — so this class of bug can't resurface if SSL ever
lapses (cert renewal failure, staging box without HTTPS, etc.).

# Customer Web App

The customer-facing web application for CityMarket. Built with Vite + React + TypeScript + Tailwind CSS. Dev server runs on port 5173.

**Location:** `web/customer/`

---

## Tech Stack

| Concern | Library |
|---|---|
| Build | Vite |
| UI | React 18 + TypeScript |
| Styling | Tailwind CSS |
| Routing | React Router v6 |
| Server state | TanStack Query (React Query) |
| Client state | Zustand |
| HTTP | Axios |
| Forms | React Hook Form + Zod |
| Realtime | Socket.IO client |
| Push notifications | Firebase Cloud Messaging (FCM) |
| i18n | react-i18next (Arabic default, English) |
| Animations | Framer Motion |

---

## Project Structure

```
src/
├── app/
│   ├── Router.tsx               # Route definitions + auth guards
│   └── providers/
│       ├── NotificationProvider.tsx  # Mounts Socket + FCM + SW
│       └── QueryProvider.tsx         # TanStack Query client
├── components/
│   ├── layout/
│   │   ├── Layout.tsx           # Shell: Navbar + Outlet + Footer + BottomNav
│   │   ├── Navbar.tsx           # Desktop nav, unread badge, language toggle
│   │   ├── Footer.tsx           # Desktop footer links
│   │   └── MobileBottomNav.tsx  # Mobile tab bar (5 tabs)
│   ├── notifications/
│   │   ├── NotificationToast.tsx        # Foreground toast stack (max 3)
│   │   └── NotificationPermissionBanner.tsx  # Inline permission nudge
│   ├── shared/
│   │   ├── VendorCard.tsx       # Card used in home + stores pages
│   │   ├── ProductCard.tsx      # Card used in store + search pages
│   │   └── TermsModal.tsx       # First-launch terms gate
│   └── ui/                      # Button, Input, Modal, Badge, Skeleton
├── hooks/
│   ├── useSocket.ts             # Socket.IO connection + event routing
│   ├── useFCM.ts                # FCM token registration + foreground messages
│   ├── useNotificationPermission.ts  # Browser permission sync + cooldown
│   └── useLanguage.ts           # RTL/LTR toggle, persisted language
├── lib/
│   ├── firebase.ts              # Firebase app + lazy Messaging singleton
│   ├── notificationSound.ts     # Plays in-app notification sound
│   └── utils.ts                 # getImageUrl, cn, formatters
├── locales/
│   ├── en/translation.json
│   └── ar/translation.json
├── pages/                       # One file per route (lazy-loaded)
├── services/api/                # Axios wrappers per domain
├── store/                       # Zustand stores (auth, cart, notifications)
└── types/index.ts               # All shared TypeScript types + enums
```

---

## Routing

All routes are lazy-loaded via `React.lazy`. Two auth guards wrap routes:

- **`RequireAuth`** — redirects unauthenticated users to `/login?redirect=<current-path>`.
- **`GuestOnly`** — redirects already-authenticated users back to `/`.

### Route Table

| Path | Page | Auth |
|---|---|---|
| `/login` | LoginPage | Guest only |
| `/register` | RegisterPage | Guest only |
| `/terms` | TermsPage | Public |
| `/` | HomePage | Required |
| `/search` | SearchPage | Required |
| `/stores` | StoresPage | Required |
| `/store/:vendorId` | StoreDetailsPage | Required |
| `/store/:vendorId/reviews` | VendorReviewsPage | Required |
| `/product/:productId` | ProductDetailsPage | Required |
| `/cart` | CartPage | Required |
| `/checkout` | CheckoutPage | Required |
| `/orders` | OrdersPage | Required |
| `/orders/:orderId` | OrderDetailsPage | Required |
| `/orders/:orderId/proposals` | ReviewProposalsPage | Required |
| `/profile` | ProfilePage | Required |
| `/addresses` | AddressesPage | Required |
| `/notifications` | NotificationsPage | Required |
| `/settings/language` | LanguageSettingsPage | Required |

---

## State Management

### `authStore` (Zustand + `persist`)

Persisted to `localStorage` under key `auth-storage`.

```
token           string | null   — JWT access token
refreshToken    string | null
user            User | null
isAuthenticated boolean

signIn(user, token, refreshToken)  — writes to localStorage + store
signOut()                          — clears localStorage + store
```

On module load the store registers a `signOutCallback` with the Axios client so 401 responses automatically trigger sign-out.

### `cartStore` (Zustand + `persist`)

Persisted under key `citymarket-cart`. Supports two measurement modes:

- **UNIT** items: accumulate by `quantity`.
- **WEIGHT** items: accumulate by `weightGrams` (displayed as kg).

```
items           CartItem[]
addToCart(item)           — merges if duplicate, skips unavailable items
removeFromCart(id)
updateQuantity(id, qty)   — removes item if qty ≤ 0
updateWeight(id, grams)   — removes item if grams ≤ 0
clearCart()
```

Selectors exported separately: `selectCartTotal`, `selectCartItemCount`.

### `notificationStore` (Zustand + `persist`)

Persisted under key `cm-notification-prefs`. Only preferences are persisted; runtime state rehydrates on mount.

| Field | Persisted | Purpose |
|---|---|---|
| `soundEnabled` | Yes | Toggle notification sound |
| `fcmToken` | Yes | Cached FCM device token (avoids redundant API calls) |
| `lastPermissionPrompt` | Yes | Timestamp of last browser permission request |
| `permissionStatus` | No | Current browser permission state |
| `socketConnected` | No | Whether Socket.IO is live |
| `toastQueue` | No | Up to 3 foreground notification toasts |

---

## API Client

`src/services/api/apiClient.ts` — singleton Axios instance.

- **Base URL:** `VITE_API_URL` env var (defaults to `http://localhost/api/v1`).
- **Request interceptor:** attaches `Authorization: Bearer <token>` from localStorage.
- **Response interceptor:** handles token refresh on 401.
  - If a refresh is already in flight, subsequent 401s are queued and replayed with the new token once refresh completes.
  - If refresh fails (or no refresh token exists), `clearSession()` is called which triggers the registered sign-out callback and clears localStorage.

### API Services

| File | Responsibility |
|---|---|
| `authService.ts` | login, register, logout, refresh |
| `userService.ts` | get/update customer profile, create customer record |
| `vendorService.ts` | list vendors, get vendor detail |
| `catalogService.ts` | list products by vendor, get product detail, search |
| `orderService.ts` | create order, list orders, get order detail, cancel, confirm |
| `ratingService.ts` | submit vendor rating |
| `notificationService.ts` | get paginated notifications, mark read, device token registration |

---

## Internationalization

- Default language: **Arabic (RTL)**.
- Supported: `ar`, `en`.
- Translation files: `src/locales/{ar,en}/translation.json`.
- `useLanguage()` hook sets `document.documentElement.lang` and `dir` on language change.
- All visible strings go through `t()` from `useTranslation()`. Module-level constants that need translation are converted to hooks or use sentinel strings translated at render time.

---

## Notification System

The app has two parallel channels for delivering real-time notifications: **Socket.IO** (while the app is open) and **Firebase Cloud Messaging** (foreground and background). Both channels feed into the same `notificationStore` toast queue and invalidate the same TanStack Query cache keys.

### Architecture Overview

```
Backend
  ├─ Socket.IO gateway  ──────────────────────────► useSocket (in-app)
  └─ FCM via notification-service ──┬─────────────► useFCM (foreground, app open)
                                    └─────────────► Service Worker (background, app closed/hidden)

Both channels → notificationStore.enqueueToast → NotificationToast (UI)
             → queryClient.invalidateQueries    → badge + list refresh
```

### `NotificationProvider`

Mounted inside the Router so all hooks can access `navigate`. It:

1. Calls `useSocket()` — establishes the Socket.IO connection.
2. Calls `useFCM()` — registers the FCM token and listens for foreground messages.
3. Calls `useNotificationPermission()` — syncs browser permission state into the store.
4. Registers `firebase-messaging-sw.js` as the service worker (PWA + background push).
5. Listens for `NAVIGATE` messages posted by the service worker when the user clicks a background notification, then calls `navigate()` to deep-link inside the already-open app.
6. Renders `<NotificationToastContainer />`.

### Channel 1 — Socket.IO (`useSocket`)

Connects to `VITE_WEBSOCKET_URL` with the JWT access token as the Socket.IO `auth` parameter. Reconnects automatically with exponential back-off (1 s → 10 s max).

**Subscribed events (19 total):**

```
ORDER_CREATED, ORDER_CONFIRMED, ORDER_CANCELLED, ORDER_READY,
ORDER_ON_THE_WAY, ORDER_PICKED_UP, ORDER_DELIVERED,
ORDER_AWAITING_CUSTOMER_CONFIRMATION, COURIER_ASSIGNED,
VENDOR_ORDER_CONFIRMED, VENDOR_ORDER_PROPOSED, VENDOR_ORDER_CANCELLED,
DELIVERY_FAILED, DELIVERY_CANCELLED_BY_COURIER, USER_REGISTERED,
PROPOSAL_ACCEPTED, PROPOSAL_REJECTED, ORDER_PREPARING
```

On each event:
1. Looks up the human-readable label from `EVENT_LABELS`.
2. Enqueues a toast in `notificationStore`.
3. Plays a sound if `soundEnabled`.
4. Invalidates TanStack Query keys from `QUERIES_TO_INVALIDATE` (always `notifications-count` + `notifications`; order events also invalidate `orders` and the specific `order/<id>`).

Socket handlers use refs for `soundEnabled` and `enqueueToast` so the socket never needs to reconnect when preferences change.

### Channel 2 — Firebase Cloud Messaging (`useFCM`)

#### Token Registration

Runs when `isAuthenticated && permissionStatus === 'granted' && VAPID_KEY`.

1. Waits for the service worker to be ready.
2. Sends the Firebase config to the service worker via `postMessage({ type: 'FIREBASE_CONFIG', config })` so the SW can initialize its own Firebase instance for background messages.
3. Calls `getToken(messaging, { vapidKey, serviceWorkerRegistration })` to obtain the FCM registration token.
4. Compares with the cached `fcmToken` in the store — only calls `NotificationService.registerDeviceToken()` if the token changed.
5. On sign-out, calls `NotificationService.unregisterDeviceToken()` and clears the cached token.

#### Foreground Messages

While the app tab is active, FCM delivers messages via `onMessage()`. Each message is converted to a `LiveNotification` and enqueued as a toast. The `notifications-count` and `notifications` cache keys are also invalidated.

#### Background Messages (Service Worker)

When the app is in the background or closed, `firebase-messaging-sw.js` handles the push. On notification click, the SW posts a `NAVIGATE` message to any open window of the app, which `NotificationProvider` intercepts and routes via React Router without opening a new tab.

### Browser Permission (`useNotificationPermission`)

- Reads `Notification.permission` on mount and syncs it to the store.
- `requestPermission()` enforces a **7-day cooldown**: after a dismissal the user is not prompted again for 7 days. The timestamp is persisted in `notificationStore`.
- `shouldShowBanner` drives the inline `NotificationPermissionBanner` component (shown in the layout when permission is `default` and cooldown has passed).

### Notification API (`NotificationService`)

```
GET /notification/notifications?page=&limit=
  → { data: { items: Notification[], total: number, unread: number } }

PATCH /notification/notifications/:id/read
PATCH /notification/notifications/read-all

POST /notification/device-token     { token, platform: "WEB", appType: "CUSTOMER" }
DELETE /notification/device-token   { token }
```

The `notifications-count` query (in Navbar and NotificationsPage) calls `getNotifications(1, 1)` — it only needs the `unread` count, not the items. The `NotificationsPage` uses `useInfiniteQuery` with `limit=20` and advances pages while `items.length === 20`.

The fallback `?? { items: [], unread: 0 }` in `getNotifications` guards against the query returning `undefined` if the API response envelope is missing, which would cause TanStack Query to throw.

### Toast UI (`NotificationToast`)

The `toastQueue` in `notificationStore` holds at most **3** toasts (newest first). The `NotificationToastContainer` renders them as a fixed stack. Each toast auto-dismisses after a timeout and can be manually dismissed.

### Sound

`src/lib/notificationSound.ts` plays an in-app audio cue. Controlled by `notificationStore.soundEnabled` (toggled in Profile). Both `useSocket` and `useFCM` check this flag before playing.

---

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API base URL (e.g. `http://localhost/api/v1`) |
| `VITE_WEBSOCKET_URL` | Socket.IO server URL |
| `VITE_FIREBASE_API_KEY` | Firebase project API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | FCM sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |
| `VITE_FIREBASE_VAPID_KEY` | VAPID key for FCM web push |

Firebase vars are all optional — if any of `apiKey`, `projectId`, `messagingSenderId`, or `appId` is missing, FCM is silently disabled (`isFirebaseConfigured = false`). Socket.IO notifications still work independently.

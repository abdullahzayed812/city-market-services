/* global firebase */

// ── Firebase compat scripts (required for service worker environment) ─────────
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// ── PWA cache config ──────────────────────────────────────────────────────────
const CACHE_NAME = 'citymarket-v1';
const PRECACHE_URLS = ['/', '/index.html'];

// ── Deep-link routing map ─────────────────────────────────────────────────────
const EVENT_ROUTES = {
  ORDER_CREATED: '/orders',
  ORDER_CONFIRMED: '/orders',
  ORDER_READY: '/orders',
  ORDER_DELIVERED: '/orders',
  ORDER_CANCELLED: '/orders',
  ORDER_PICKED_UP: '/orders',
  COURIER_ASSIGNED: '/orders',
  ORDER_AWAITING_CUSTOMER_CONFIRMATION: '/orders',
  VENDOR_ORDER_PROPOSED: '/orders',
  VENDOR_ORDER_CONFIRMED: '/orders',
  NEW_REVIEW: '/profile',
  LOW_STOCK: '/',
  DEFAULT: '/notifications',
};

// ── Notification icon assets (served from /public) ────────────────────────────
const NOTIFICATION_ICON = '/icons/icon-192.svg';
const NOTIFICATION_BADGE = '/icons/badge-72.svg';

// ── State ─────────────────────────────────────────────────────────────────────
let firebaseInitialized = false;

// ── Receive Firebase config from the main thread ──────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'FIREBASE_CONFIG' && !firebaseInitialized) {
    try {
      firebase.initializeApp(event.data.config);
      const messaging = firebase.messaging();
      firebaseInitialized = true;

      messaging.onBackgroundMessage((payload) => {
        handleBackgroundMessage(payload);
      });
    } catch (err) {
      console.warn('[SW] Firebase init failed:', err);
    }
  }
});

// ── Background message handler ────────────────────────────────────────────────
function handleBackgroundMessage(payload) {
  const { notification, data } = payload;

  const title = notification?.title || data?.title || 'CityMarket';
  const body = notification?.body || data?.body || 'You have a new notification';
  const notificationType = data?.type || 'DEFAULT';
  const notificationId = data?.notificationId || '';
  const orderId = data?.orderId || data?.customerOrderId || '';

  const route = EVENT_ROUTES[notificationType] || EVENT_ROUTES.DEFAULT;

  self.registration.showNotification(title, {
    body,
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_BADGE,
    tag: notificationId || notificationType, // Collapse duplicates
    renotify: false,
    requireInteraction: notificationType === 'ORDER_AWAITING_CUSTOMER_CONFIRMATION' ||
                        notificationType === 'VENDOR_ORDER_PROPOSED',
    vibrate: [200, 100, 200],
    data: { route, orderId, notificationId, type: notificationType },
    actions: getNotificationActions(notificationType),
  });
}

// ── Action buttons on native notifications ────────────────────────────────────
function getNotificationActions(type) {
  if (type === 'ORDER_AWAITING_CUSTOMER_CONFIRMATION' || type === 'VENDOR_ORDER_PROPOSED') {
    return [{ action: 'view', title: 'View Order' }];
  }
  if (type === 'ORDER_DELIVERED') {
    return [{ action: 'view', title: 'Rate your order' }];
  }
  return [{ action: 'view', title: 'View' }];
}

// ── Notification click handler ────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const { route, orderId, type } = event.notification.data || {};
  let targetUrl = self.location.origin + (route || '/notifications');

  // Deep-link to specific order or proposals if we have an ID
  if (orderId) {
    if (type === 'VENDOR_ORDER_PROPOSED' || type === 'ORDER_AWAITING_CUSTOMER_CONFIRMATION') {
      targetUrl = `${self.location.origin}/orders/${orderId}/proposals`;
    } else if (route === '/orders' || !route) {
      targetUrl = `${self.location.origin}/orders/${orderId}`;
    }
  }

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // If the app is already open, focus it and navigate
        for (const client of windowClients) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            client.focus();
            client.postMessage({ type: 'NAVIGATE', url: targetUrl });
            return;
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      }),
  );
});

// ── Notification close handler (analytics hook) ───────────────────────────────
self.addEventListener('notificationclose', (_event) => {
  // Can be used for analytics — notification dismissed without click
});

// ── PWA: Cache static assets on install ──────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // Non-fatal if precache fails (e.g., offline at install time)
      });
    }),
  );
});

// ── PWA: Activate + clean old caches ─────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      ),
    ).then(() => self.clients.claim()),
  );
});

// ── PWA: Fetch handler — network-first, fallback to cache ────────────────────
self.addEventListener('fetch', (event) => {
  // Only handle GET requests for same-origin
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Skip API calls — always network
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful HTML/asset responses
        if (response.ok && (
          event.request.destination === 'document' ||
          event.request.destination === 'script' ||
          event.request.destination === 'style' ||
          event.request.destination === 'image'
        )) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        // Network failed — try cache; for document requests serve index.html (SPA)
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.destination === 'document') {
            return caches.match('/index.html');
          }
          return new Response('', { status: 503 });
        }),
      ),
  );
});

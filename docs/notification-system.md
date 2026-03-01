# Notification System Documentation

This document provides a technical overview of the event-driven Notification System implemented in the CityMarket microservices monorepo.

## 1. Architecture Overview

The system follows a fully decoupled, event-driven architecture using **RabbitMQ** as the message broker.

- **Source Services**: Services like `order-service`, `delivery-service`, and `user-service` publish domain events to the `citymarket_events` exchange.
- **Transport**: RabbitMQ Topic Exchange allows for granular routing and dead-letter handling.
- **Sink Service**: `notification-service` consumes specific events and translates them into user-facing notifications.
- **Delivery Channels**: Currently supports **FCM Push Notifications** (via Firebase Admin SDK) and **Console Logging** (fallback for development).

## 2. Configuration & Setup

### Firebase Credentials
The system supports three methods for providing Firebase Service Account credentials in the `notification-service`:

1.  **Method 1: ENV JSON (Recommended for Docker/Prod)**
    - Set `FIREBASE_SERVICE_ACCOUNT_JSON` to the raw stringified JSON content of your service account key.
2.  **Method 2: ENV Path**
    - Set `FIREBASE_SERVICE_ACCOUNT_PATH` to the absolute path of your `.json` key file on the server.
3.  **Method 3: Default File (Recommended for Local Dev)**
    - Place your service account key at `services/notification-service/src/config/firebase-service-account.json`.

**Note:** If no credentials are found, the system will log notifications to the console for debugging purposes.

## 3. Database Schema

Managed within the `notification_db` (MySQL):

- `notifications`: Stores history of all alerts sent to users.
- `notification_preferences`: User-specific settings (Email/Push/SMS toggles).
- `device_tokens`: Multi-device mapping for users (FCM tokens).

## 4. API Reference

All endpoints are reachable via the API Gateway (typically `/api/v1/notification/...`).

### Device Management
- `POST /device-token`: Register or update a device's FCM token.
  - Body: `{ "token": "...", "platform": "ANDROID" | "IOS" | "WEB" }`

### Notification History
- `GET /notifications`: Fetch paginated notification history.
- `PATCH /notifications/:id/read`: Mark a single notification as read.
- `PATCH /notifications/read-all`: Mark all user notifications as read.

## 5. Event-to-Notification Mapping

| Event Type | Recipient | Action/Trigger |
| :--- | :--- | :--- |
| `ORDER_CREATED` | Vendor | Notifies vendor of a new incoming order. |
| `ORDER_CONFIRMED` | Customer | Confirmation alert after vendor accepts. |
| `COURIER_ASSIGNED` | Customer | Alert when a delivery partner is assigned. |
| `ORDER_PICKED_UP` | Customer | Transit alert (Order is on the way). |
| `ORDER_DELIVERED` | Customer | Final delivery confirmation. |
| `USER_REGISTERED` | User | Welcome message initialization. |

## 6. Mobile Integration (Customer App)

### Implementation Detail: `useNotifications.ts`
The mobile app uses a custom hook located in `src/hooks/useNotifications.ts`.

- **On Startup/Login**: Requests permissions and retrieves the FCM token.
- **Registration**: Calls the backend `POST /device-token` to link the token to the logged-in user.
- **Foreground**: Displays interactive `Toast` notifications for incoming messages.
- **Background**: System-level notifications handled by the OS.

### Requirements for Continuation
To enable real push notifications on a physical device:
1.  Add `google-services.json` (Android) and `GoogleService-Info.plist` (iOS).
2.  Ensure native modules are linked: `@react-native-firebase/app` and `@react-native-firebase/messaging`.
3.  Rebuild the native application.

## 7. Safety & Reliability
- **Deduplication**: Multi-device support is handled via multicast.
- **Error Handling**: Failed RabbitMQ messages are routed to a Dead Letter Queue (`_dlq`) for inspection.
- **Graceful Fallback**: The system remains operational even without Firebase credentials by using the Log Provider.

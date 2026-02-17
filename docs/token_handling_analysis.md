### Executive Summary

**Overall Assessment:**
The current system demonstrates a fundamental understanding of JWT-based authentication at the API Gateway level, where user tokens are issued and expected. However, the subsequent handling of these tokens within the Admin and Order microservices reveals several significant anti-patterns and security vulnerabilities. The most critical issue is the widespread use of user tokens for internal service-to-service communication and their inclusion in asynchronous event payloads. This approach tightly couples services, introduces security risks, and prevents proper service isolation and authentication.

**Severity Rating:** Critical

**Top 3 Issues to Address:**

1.  **User Tokens in Event Payloads:** The `OrderService` explicitly includes user tokens in the payload of `ORDER_READY` events, which is a severe security risk and violates event-driven architecture principles.
2.  **Lack of Service-to-Service Authentication:** Internal calls between microservices (e.g., Admin -> Order, Order -> Catalog/Vendor) are authenticated using the original user's token. This is an anti-pattern; internal service calls should use dedicated service tokens for robust and secure communication.
3.  **Redundant Token Extraction and Propagation:** Tokens are repeatedly extracted in individual controllers and then passed through multiple layers (controller -> service -> HTTP client), leading to code duplication, increased complexity, and higher risk of accidental exposure.

### Detailed Findings

**1. Token Usage Audit**

- **Admin Service - `services/admin-service/src/presentation/controllers/admin.controller.ts`**
  - **Description:** All controller methods (`getDashboard`, `getAllOrders`, `getAllVendors`, etc.) extract the user's JWT from `req.headers.authorization`.
  - **Code Location:** `admin.controller.ts`, lines 10, 20, 32, etc. (18 occurrences)
  - **Current Code Snippet:** `const token = req.headers.authorization?.split(" ")[1];`
  - **Purpose:** User authentication for actions performed via the Admin Dashboard.
  - **Token Flow:** HTTP Request Header → Controller (extraction) → AdminService method (parameter)
  - **Token Type:** User token.
- **Admin Service - `services/admin-service/src/application/services/admin.service.ts`**
  - **Description:** Service methods receive the user token and pass it directly to the `ServiceClient` for calls to other microservices.
  - **Code Location:** `admin.service.ts`, lines 13, 27, 31, etc. (e.g., `getDashboardStats`, `getAllOrders`)
  - **Current Code Snippet:** `this.serviceClient.getAllOrders(1, 100, token)`
  - **Purpose:** Propagate user's authentication context to downstream services.
  - **Token Flow:** AdminController → AdminService method (parameter) → ServiceClient method (parameter)
  - **Token Type:** User token.
- **Admin Service - `services/admin-service/src/infrastructure/http/service-client.ts`**
  - **Description:** The generic `ServiceClient` includes the received token in the `Authorization: Bearer <token>` header for all outgoing HTTP requests to other services (Order, Vendor, Delivery, Auth).
  - **Code Location:** `service-client.ts`, lines 12, 21, 29, etc. (all methods)
  - **Current Code Snippet:** `headers: token ? { Authorization: `Bearer ${token}` } : {},`
  - **Purpose:** Authenticate requests to other internal microservices using the original user's token.
  - **Token Flow:** AdminService method → ServiceClient method (parameter) → Outgoing HTTP Request Header
  - **Token Type:** User token.
- **Order Service - `services/order-service/src/presentation/controllers/order.controller.ts`**
  - **Description:** Specific controller methods (`create`, `getVendorOrderById`, `getCustomerOrderById`) extract the user's JWT from `req.headers.authorization`.
  - **Code Location:** `order.controller.ts`, lines 12, 34, 100.
  - **Current Code Snippet:** `const token = req.headers.authorization?.split(" ")[1];`
  - **Purpose:** User authentication for actions performed on orders.
  - **Token Flow:** HTTP Request Header → Controller (extraction) → OrderService method (parameter)
  - **Token Type:** User token.
- **Order Service - `services/order-service/src/application/services/order.service.ts`**
  - **Description:**
    - `createOrder`: Passes the user token to `CatalogHttpClient` to fetch product details.
    - `getCustomerOrderById`, `getVendorOrderById`: Pass the user token to `VendorHttpClient` to fetch vendor details.
    - `syncCustomerOrderStatus` (private method): Includes the user token directly into the payload of the `ORDER_READY` event.
  - **Code Location:**
    - `order.service.ts`, line 42 (`createOrder`)
    - `order.service.ts`, lines 212, 240 (`getCustomerOrderById`, `getVendorOrderById`)
    - `order.service.ts`, line 639 (`syncCustomerOrderStatus` event payload)
  - **Current Code Snippets:**
    - `this.catalogClient.getProduct(item.productId, token)`
    - `this.vendorClient.getVendor(vo.vendorId, token)`
    - `payload: { customerOrderId, status: newStatus, customerId: customerOrder.customerId, token },`
  - **Purpose:**
    - Authenticate calls to Catalog/Vendor services with user context.
    - **Problematic:** Pass user token via event for `ORDER_READY` event.
  - **Token Flow:**
    - OrderController → OrderService method (parameter) → Catalog/Vendor HttpClient method (parameter)
    - OrderService method → `syncCustomerOrderStatus` method (parameter) → Event Payload
  - **Token Type:** User token.
- **Order Service - `services/order-service/src/infrastructure/http/catalog-http-client.ts`**
  - **Description:** Includes the received token in the `Authorization: Bearer <token>` header for outgoing HTTP requests to the Catalog Service.
  - **Code Location:** `catalog-http-client.ts`, lines 17, 30.
  - **Current Code Snippet:** `headers: token ? { Authorization: `Bearer ${token}` } : {},`
  - **Purpose:** Authenticate requests to the Catalog service using the original user's token.
  - **Token Flow:** OrderService method → CatalogHttpClient method (parameter) → Outgoing HTTP Request Header
  - **Token Type:** User token.
- **Order Service - `services/order-service/src/infrastructure/http/vendor-http-client.ts`**
  - **Description:** Includes the received token in the `Authorization: Bearer <token>` header for outgoing HTTP requests to the Vendor Service.
  - **Code Location:** `vendor-http-client.ts`, line 19.
  - **Current Code Snippet:** `headers: token ? { Authorization: `Bearer ${token}` } : {},`
  - **Purpose:** Authenticate requests to the Vendor service using the original user's token.
  - **Token Flow:** OrderService method → VendorHttpClient method (parameter) → Outgoing HTTP Request Header
  - **Token Type:** User token.

**2. Problematic Patterns**

- **a) Tokens in Events:**

  - **Description:** The `syncCustomerOrderStatus` method in `order.service.ts` adds the `token` to the `payload` of the `ORDER_READY` event. This means any service consuming this event will receive the user's JWT.
  - **Code Location:** `services/order-service/src/application/services/order.service.ts`, line 639.
  - **Current Code Snippet:**
    ```typescript
    eventsToEmit.push({
      id: randomUUID(),
      type: eventType,
      timestamp: new Date(),
      payload: { customerOrderId, status: newStatus, customerId: customerOrder.customerId, token }, // <-- Problematic
    });
    ```
  - **Why it's problematic:**
    - **Security Risk:** Sensitive user credentials (JWTs) are exposed in an asynchronous, potentially less secure, messaging queue. If the event bus is compromised, tokens can be harvested.
    - **Replay Attacks:** If the event can be replayed, the token could be reused for unauthorized actions.
    - **Expired Tokens:** The token in the event payload will eventually expire, making it useless for downstream consumers and requiring complex handling.
    - **Tight Coupling & Breaking Microservice Boundaries:** Forces event consumers to understand and rely on the original user's authentication context, blurring the lines between user-initiated and system-initiated actions. Events should convey facts, not authentication artifacts.
  - **Impact if not fixed:** Significant security vulnerability, leading to token leakage, potential unauthorized access if tokens are compromised, and brittle event-driven architecture.

- **b) Token Propagation Issues:**

  - **Description:** In both Admin and Order services, the user token is extracted in the controller and then passed explicitly as a parameter through the application service layer down to the infrastructure HTTP client layer.
  - **Code Location:**
    - `admin.controller.ts` -> `admin.service.ts` -> `service-client.ts`
    - `order.controller.ts` -> `order.service.ts` -> `catalog-http-client.ts` / `vendor-http-client.ts`
  - **Current Code Snippet:** (Numerous examples, e.g., `this.adminService.getDashboardStats(token)`, `this.serviceClient.getAllOrders(..., token)`)
  - **Why it's problematic:**
    - **Violation of Separation of Concerns:** Authentication concerns (token handling) are intertwined with business logic, leading to polluted method signatures.
    - **Code Duplication:** The token extraction logic is repeated in every controller method.
    - **Increased Complexity:** Every method in the call stack needs to explicitly handle and pass the token, making the codebase harder to maintain and reason about.
    - **Risk of Accidental Exposure:** More places where the token is handled increases the chance of it being accidentally logged or exposed.
  - **Impact if not fixed:** Maintenance burden, code complexity, and increased surface area for security bugs.

- **c) Missing Service Authentication:**

  - **Description:** Internal service-to-service HTTP calls are being made using the end-user's JWT (e.g., Admin Service calling Order Service with the user's token; Order Service calling Catalog Service with the user's token).
  - **Code Location:**
    - `services/admin-service/src/infrastructure/http/service-client.ts` (all methods)
    - `services/order-service/src/infrastructure/http/catalog-http-client.ts` (all methods)
    - `services/order-service/src/infrastructure/http/vendor-http-client.ts` (all methods)
  - **Current Code Snippet:** `headers: token ? { Authorization: `Bearer ${token}` } : {},` (within client calls)
  - **Why it's problematic:**
    - **Lack of Least Privilege:** A service calling another service doesn't necessarily need the full context and permissions of the end-user. It needs its _own_ identity and permissions to perform its designated task. Using user tokens gives the called service more privileges than it might need for an internal operation.
    - **Reduced Resilience:** If the user token expires or is invalid, internal service operations might fail, even if the service itself is authorized to perform the action.
    - **Difficult Debugging/Tracing:** Harder to distinguish between user-initiated failures and internal service authentication failures.
    - **Breaks Service Autonomy:** Services cannot operate independently or perform background tasks without an active user context.
  - **Impact if not fixed:** Security vulnerabilities due to over-privileging, brittle inter-service communication, and hindered scalability and autonomy of microservices.

- **d) Security Concerns:**
  - **Description:** While no explicit logging of tokens was observed, the extensive propagation of tokens increases the risk of accidental exposure in logs, especially if error handling or debugging statements are not carefully implemented.
  - **Why it's problematic:** Tokens are sensitive credentials. Any logging of them, even inadvertently, creates a severe security risk.
  - **Impact if not fixed:** Token leakage leading to potential unauthorized access.

**3. Architecture Analysis**

- **a) User Token Usage:**

  - **Where appropriate (user-initiated operations):** The API Gateway should be responsible for authenticating the end-user and validating their JWT. The user token is appropriate for initial authentication at the edge of the system to identify the user and determine if they are authorized to _initiate_ a request.
  - **Where inappropriate (system operations, event handlers):** User tokens are currently inappropriately used for internal service-to-service communication (e.g., Order calling Catalog) and are severely problematic when included in event payloads (e.g., `ORDER_READY` event). Internal services performing their logic, especially if it involves calling other services or responding to events, should use service tokens or other service-to-service authentication mechanisms.

- **b) Service Token Needs:**

  - **Operations that should use service-to-service authentication:** All inter-service HTTP calls where one microservice calls another (e.g., Admin Service calling Order Service, Order Service calling Catalog Service, Order Service calling Vendor Service) should use service-to-service authentication.
  - **Event consumers that need to call other services:** Any event consumer (e.g., a potential consumer of `ORDER_READY` event) that needs to perform subsequent actions by calling other services should use a service token to authenticate its requests. It should _not_ rely on a user token from the event payload.
  - **Background jobs or scheduled tasks:** Any background process initiated by a service (not a direct user request) that needs to interact with other services _must_ use service tokens.

- **c) Token Lifecycle:**
  - **How tokens are validated:** The architecture implies that tokens are validated by downstream services if they are passed. However, the primary validation should occur at the API Gateway. Downstream services should ideally validate the _service token_ they receive, and for user context, rely on trusted information passed from the API Gateway (e.g., decoded user ID, roles, etc., signed and verified by the Gateway, not the raw user JWT).
  - **Token expiration handling:** Not explicitly seen. If user tokens are passed around and expire during a complex multi-service operation, it could lead to failures. Service tokens would need their own expiration and refresh mechanisms.
  - **Token refresh mechanisms (if any):** Not explicitly seen within the microservices themselves. This is typically handled by the Auth Service and client applications.

### 4. Provide Detailed Recommendations

**a) Immediate Issues to Fix (Critical):**

- **Security Vulnerability: Tokens in Events**
  - **Problem:** User tokens are included in event payloads, specifically the `ORDER_READY` event from `OrderService.syncCustomerOrderStatus`.
  - **What needs to change:** Remove `token` from all event payloads. Events should only contain necessary data, not credentials.
  - **How to implement the fix:**
    1.  Modify `syncCustomerOrderStatus` to remove `token` from the `payload` of the `ORDER_READY` event.
    2.  Identify and update any event consumers that might be expecting `token` from this event. Consumers needing to perform authenticated actions should use their own service tokens.
  - **Code Examples:**
    - **Before (`services/order-service/src/application/services/order.service.ts`):**
      ```typescript
      // Line ~637-640
      eventsToEmit.push({
        id: randomUUID(),
        type: eventType,
        timestamp: new Date(),
        payload: { customerOrderId, status: newStatus, customerId: customerOrder.customerId, token },
      });
      ```
    - **After (`services/order-service/src/application/services/order.service.ts`):**
      ```typescript
      // Line ~637-640
      eventsToEmit.push({
        id: randomUUID(),
        type: eventType,
        timestamp: new Date(),
        payload: { customerOrderId, status: newStatus, customerId: customerOrder.customerId }, // Token removed
      });
      ```

**b) Architecture Improvements (High Priority):**

- **Implement Service-to-Service Authentication:**

  - **Problem:** Internal microservices use the end-user's token to authenticate calls to other internal microservices.
  - **What needs to change:** Implement a dedicated service-to-service authentication mechanism. Each service should have its own identity and obtain/use a service token when calling other internal services. The user's context (e.g., `userId`) should be passed explicitly as data if needed, not as a raw token.
  - **How to implement the fix:**
    1.  **Service Identity:** Each service (Admin, Order, Catalog, Vendor, Delivery, Auth) needs a service account/identity, possibly defined in an Identity Provider (Auth Service).
    2.  **Service Token Generation:** Services should be able to obtain their own short-lived service tokens (e.g., JWTs signed by the Auth Service, or an API Key that can be exchanged for a token). This could be done at service startup or via a refresh mechanism.
    3.  **HTTP Client Modification:** Modify `ServiceClient`, `CatalogHttpClient`, `VendorHttpClient` (and any other internal HTTP clients) to use a configurable service token by default for inter-service calls.
    4.  **Context Propagation:** If the user's identity is _truly_ needed downstream for authorization decisions (e.g., "is this user allowed to view this specific order?"), then the API Gateway should _decode_ the user's JWT, validate it, and then pass only the necessary (and verifiable) user claims (e.g., `userId`, `roles`) as custom HTTP headers (e.g., `X-User-Id`, `X-User-Roles`) to the first downstream service. This service can then propagate these specific claims if needed. The raw user token should _not_ be passed.
  - **Migration Strategy:** This is a significant change. It should be rolled out service by service. Start by implementing service token generation and then update the HTTP clients in one service (e.g., Admin Service) to use it. Test thoroughly before moving to the next.

- **Separate User Tokens from Service Tokens:**

  - **Problem:** The current `token` parameter is overloaded, sometimes carrying a user token, sometimes potentially intended for service communication.
  - **What needs to change:** Clearly distinguish between user tokens (handled at the edge) and service tokens (for internal communication).
  - **How to implement the fix:** See "Implement Service-to-Service Authentication" above. For internal calls, always prioritize service tokens.

- **Clean Up Token Propagation Through Layers:**

  - **Problem:** User tokens are passed explicitly through `Controller -> Service -> HTTP Client` layers.
  - **What needs to change:** Implement an authentication middleware for each service to handle user token extraction and validation, injecting user context (e.g., `req.userId`) into the request object. Services should then rely on this context, not the raw token.
  - **How to implement the fix:**
    1.  **Centralized User Auth Middleware:** Create/enhance an authentication middleware (similar to `auth.middleware.ts` but specific to each service's internal endpoints) that intercepts incoming requests, extracts the user token, validates it (possibly by calling the Auth Service or using a shared public key), and populates `req.user` or `req.userId`.
    2.  **Remove Token Parameters from Business Logic:** Once user context is available via `req.user`, remove the `token` parameter from controller methods and subsequent service methods _that only deal with user context_. Business logic methods should not receive raw tokens.
  - **Code Examples (Conceptual):**

    - **Before (Controller):**
      ```typescript
      // services/admin-service/src/presentation/controllers/admin.controller.ts
      async getDashboard = async (req: Request, res: Response, next: NextFunction) => {
        try {
          const token = req.headers.authorization?.split(" ")[1];
          const stats = await this.adminService.getDashboardStats(token); // <-- token passed
          res.json(ApiResponse.success(stats));
        } catch (error) { next(error); }
      };
      ```
    - **After (Controller with Middleware):**

      ```typescript
      // services/admin-service/src/presentation/controllers/admin.controller.ts
      // Assume AuthRequest extends Request and has req.userId set by middleware
      async getDashboard = async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
          // No token extraction here
          const stats = await this.adminService.getDashboardStats(req.userId); // Pass user ID if needed, or no auth context
          res.json(ApiResponse.success(stats));
        } catch (error) { next(error); }
      };

      // services/admin-service/src/application/services/admin.service.ts
      // Method signature changes
      async getDashboardStats(userId: string) { // No token parameter
        // ...
        // Now uses a service token for internal calls
        const [ordersData, vendorsData, couriersData, usersData] = await Promise.all([
          this.serviceClient.getAllOrders(1, 100), // No token passed, ServiceClient uses service token
          // ...
        ]);
      }
      ```

**c) Best Practices to Adopt (Medium Priority):**

- **Standard Patterns for Token Handling:**
  - Define a clear pattern: API Gateway for user authentication, dedicated service tokens for inter-service communication, and user context propagation via validated, lightweight headers (not raw JWTs).
- **Consistent HTTP Client Configuration:**
  - Centralize HTTP client configuration (e.g., `axios` instance setup) to always inject the appropriate service token for internal calls. Provide explicit methods/options if a user context needs to be forwarded (e.g., `catalogClient.getProduct(productId, { userId: req.userId })`).
- **Event Payload Design Without Tokens:**
  - Reinforce the principle that event payloads should be self-contained data, not security credentials. Data like `userId` can be included if relevant, but not raw tokens.

**d) Refactoring Plan:**

1.  **Phase 1: Remove Tokens from Events (Critical)**

    - **What needs to change:** `OrderService.syncCustomerOrderStatus` must stop adding the `token` to the `ORDER_READY` event payload.
    - **How to implement the fix:** Edit the code as shown in the "Immediate Issues" section.
    - **Code Example:** See above.
    - **Migration Strategy:** A simple code change. Ensure no consumers are breaking. If a consumer relies on it, it must be updated to use service-to-service authentication instead.

2.  **Phase 2: Implement Service-to-Service Authentication (High Priority)**

    - **What needs to change:** All `HttpClient` classes (`ServiceClient`, `CatalogHttpClient`, `VendorHttpClient`, etc.) need to be updated to use a service token for internal calls instead of the user token. Services also need a mechanism to obtain these service tokens.
    - **How to implement the fix:**
      - **Service Token Acquisition:** Implement a module (e.g., `src/config/service-auth.ts`) in each service to fetch or manage its service token (e.g., from an environment variable as a pre-shared key, or by calling an internal Auth Service endpoint at startup/interval).
      - **HTTP Client Refactoring:** Modify constructors of `HttpClient`s to optionally receive a service token, or obtain it internally. Update methods to use this service token by default. Add an option to _override_ with a user context header (e.g., `X-User-Id`) if specific user context is needed downstream.
    - **Code Examples:** Will provide in the "Implementation Roadmap" section.
    - **Migration Strategy:**
      1.  Start with `AdminService`: Implement service token acquisition. Modify `ServiceClient` to use its service token by default. Update `AdminService` methods to stop passing user tokens to `ServiceClient` for internal calls (unless a specific user context propagation is explicitly designed and implemented).
      2.  Move to `OrderService`: Implement service token acquisition. Modify `CatalogHttpClient` and `VendorHttpClient` to use their service tokens by default. Update `OrderService` methods (`createOrder`, `getCustomerOrderById`, `getVendorOrderById`) to stop passing user tokens to these clients.

3.  **Phase 3: Centralize User Token Handling (Architecture Improvement)**
    - **What needs to change:** Remove `req.headers.authorization` extraction from controllers. Implement a dedicated authentication middleware.
    - **How to implement the fix:**
      - Create/configure a middleware (e.g., `src/middlewares/auth.middleware.ts` if not already present, or extend existing `api-gateway` middleware logic) in each service that authenticates requests.
      - This middleware should:
        1.  Extract the `Authorization` header.
        2.  Validate the token (e.g., using a public key from the Auth Service).
        3.  If valid, decode the token and set `req.user = decodedUserPayload` or `req.userId = decodedUserPayload.userId`.
        4.  Call `next()`. If invalid, return 401/403.
      - Update controller routes to use this middleware.
      - Remove `token` extraction and passing from all controllers and application service methods that deal with user context.
    - **Code Examples:** Will provide in the "Implementation Roadmap" section.
    - **Migration Strategy:** Apply this middleware to routes in one service at a time, removing the manual token extraction from corresponding controllers.

### 5. Implementation Guidance

**a) Service Token Implementation:**

- **How to generate/obtain service tokens:**
  - **Option 1 (Simple - API Key/Shared Secret):** Each service could have a unique API key (UUID) stored as an environment variable. This key is included in a custom header (e.g., `X-Service-API-Key`) for inter-service communication. The receiving service validates this key against a list of known service keys or by checking with the Auth Service.
  - **Option 2 (Recommended - JWT):**
    1.  Each service is registered with the `AuthService` and receives a `client_id` and `client_secret`.
    2.  At startup, each service makes a `client_credentials` grant type request to the `AuthService` to obtain a short-lived service JWT.
    3.  The service stores this JWT and periodically refreshes it before expiration.
    4.  This service JWT is then used as a `Bearer` token in `Authorization` headers for all internal service-to-service calls.
- **Where to store service tokens:**
  - If using API keys: Environment variables (`SERVICE_A_API_KEY`).
  - If using JWTs: In-memory (after acquisition from Auth Service), managed by a dedicated authentication client module within each service. Configuration like `client_id` and `client_secret` should be environment variables.
- **How to configure HTTP clients with service tokens:**
  - Modify the HTTP client constructors to accept a `serviceToken` or a function that provides it.
  - Default `Authorization` header should use this `serviceToken`.
- **Fallback mechanism (user token → service token):** There should be **no fallback**. User tokens are for user authentication at the edge. Service tokens are for service authentication internally. They serve different purposes and should not be interchanged. If an internal service needs to act "as" a user, the user's ID/roles should be explicitly passed as data (e.g., `X-User-ID` header) after being validated by the API Gateway, and the internal service's call would still be authenticated by its _service token_.

**b) HTTP Client Refactoring:**

- **Standard pattern for HTTP clients that support both token types (or user context):**

  - The primary authentication for internal calls should be the service token.
  - If a specific `userId` or other user context needs to be propagated, it should be passed as a separate, _verified_ custom header, not as the raw user JWT.
  - **Example `ServiceClient` modification:**

    ```typescript
    // services/admin-service/src/infrastructure/http/service-client.ts
    import axios, { AxiosInstance } from "axios";
    // Assume a mechanism to get the service token
    import { adminServiceAuthenticator } from "../../config/index"; // New module or shared utility

    export class ServiceClient {
      private axiosInstance: AxiosInstance;

      constructor(
        private orderServiceUrl: string,
        private vendorServiceUrl: string,
        private deliveryServiceUrl: string,
        private userServiceUrl: string,
        private authServiceUrl: string // Unused, as AuthService is called by authenticator
      ) {
        this.axiosInstance = axios.create(); // Create base instance, headers will be set per request
      }

      private async getRequestConfig(userId?: string) {
        const serviceToken = await adminServiceAuthenticator.getServiceToken();
        const headers: Record<string, string> = {
          Authorization: `Bearer ${serviceToken}`,
        };
        if (userId) {
          headers["X-User-Id"] = userId; // Propagate user ID from validated context
        }
        return headers;
      }

      async getAllOrders(page: number = 1, limit: number = 50, userId?: string) {
        const config = await this.getRequestConfig(userId);
        const response = await this.axiosInstance.get(`${this.orderServiceUrl}/`, {
          params: { page, limit },
          ...config, // Merge headers
        });
        return response.data;
      }
      // ... all other methods updated similarly
    }
    ```

- **How to modify existing clients (CatalogHttpClient, OrderHttpClient, VendorHttpClient):** Apply the pattern above.
- **Constructor changes needed:** Constructors should be updated to establish an `axios` instance with the service token. Methods should accept `userId` (or similar context) if needed, rather than a raw `token`.

**c) Event Payload Cleanup:**

- **Which events currently include tokens:** The `ORDER_READY` event from `OrderService.syncCustomerOrderStatus`.
- **How to modify event payloads:** Remove the `token` field from the event payload.
- **What data to include instead of tokens:** Include only the necessary identifiers and status, like `customerOrderId`, `status`, `customerId`. If an event consumer needs to act on behalf of a user, it should be designed to do so using its own service token and potentially a propagated `X-User-Id` header (if the event was triggered by a user action and that context is critical for the consumer's action).
- **Event consumer changes needed:** Any consumer of `ORDER_READY` must be updated. If it previously used the `token` from the event payload, it now needs to obtain its own service token for any authenticated actions it performs.

**d) Controller/Service Layer Changes:**

- **Which controllers need to extract and pass user tokens:** _None_ of the controllers should explicitly extract `req.headers.authorization`. This responsibility shifts to a centralized authentication middleware.
- **Which service methods need token parameters:** _No_ service methods should take a raw `token` parameter. If user context is required for business logic, pass specific, verified claims like `userId`, `roles`, etc. (e.g., `async createOrder(dto: CreateOrderDto, userId: string)`).
- **Which internal methods should NOT receive tokens:** All internal methods, especially private ones like `syncCustomerOrderStatus`, should not receive or propagate raw user tokens. They should operate based on system context or explicitly passed, verified user data.

### 6. Testing Recommendations

- **How to test service-to-service authentication:**

  - **Unit Tests:** For each HTTP client (e.g., `ServiceClient`, `CatalogHttpClient`), write tests that mock `axios` and verify that `getRequestConfig` (or similar logic) generates headers containing the correct service token (and optionally `X-User-Id` if provided).

    ```typescript
    // Example unit test for ServiceClient
    // In services/admin-service/tests/infrastructure/http/service-client.test.ts
    import axios from "axios";
    import { ServiceClient } from "../../../src/infrastructure/http/service-client";
    // Mock the authenticator
    jest.mock("../../../src/config/index", () => ({
      adminServiceAuthenticator: {
        getServiceToken: jest.fn(() => Promise.resolve("mock-service-token")),
      },
    }));
    jest.mock("axios"); // Mock axios completely

    describe("ServiceClient", () => {
      let client: ServiceClient;
      beforeEach(() => {
        client = new ServiceClient("http://order", "http://vendor", "http://delivery", "http://user", "http://auth");
      });

      it("should include service token in headers by default", async () => {
        (axios.get as jest.Mock).mockResolvedValue({ data: {} });
        await client.getAllOrders();
        expect(axios.get).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: {
              Authorization: "Bearer mock-service-token",
            },
          })
        );
      });

      it("should include X-User-Id header if provided", async () => {
        (axios.get as jest.Mock).mockResolvedValue({ data: {} });
        await client.getAllOrders(1, 50, "user123");
        expect(axios.get).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            headers: {
              Authorization: "Bearer mock-service-token",
              "X-User-Id": "user123",
            },
          })
        );
      });
    });
    ```

  - **Integration Tests:**
    1.  Deploy the Auth Service and at least two other services (e.g., Admin and Order) in a test environment.
    2.  Configure Admin Service's `client_id` and `client_secret` to obtain a service token.
    3.  Make a request to Admin Service (e.g., `GET /admin/orders`). This request should trigger Admin Service to call Order Service.
    4.  Verify (via logs or tracing) that the call from Admin to Order uses Admin's service token.
    5.  **Negative Tests:** Deploy Order Service. Attempt to directly call an Order Service internal endpoint from an unauthorized client (without any token, or with an invalid service token). Verify that Order Service rejects the request with `401 Unauthorized` or `403 Forbidden`.

- **How to verify token handling is correct:**

  - **End-to-End Tests:**
    1.  Login a user via the Auth Service/API Gateway. Get a user JWT.
    2.  Make a request to the API Gateway with the user JWT (e.g., `GET /api/admin/dashboard`).
    3.  Trace the request through API Gateway -> Admin Service -> Order Service -> etc. Verify that:
        - API Gateway passes `X-User-Id` (and `X-User-Roles`) to Admin Service.
        - Admin Service uses its service token for its calls to other services.
        - Raw user JWT is _never_ seen in internal service calls.
  - **Logging & Tracing:** Integrate OpenTelemetry or a similar distributed tracing solution. Instrument all HTTP requests and event publications. Configure sensitive data filtering to ensure no tokens are ever logged. Review traces to confirm headers and event payloads conform to the new architecture.

- **Security Test Cases to Add:**
  - **Token Replay (Events):** Attempt to manually publish an `ORDER_READY` event with a `token` field in its payload. Ensure consumers ignore or reject such payloads (if the `token` field was explicitly handled before, now it should be ignored).
  - **Missing Service Token:** Attempt to bypass the API Gateway and directly call a microservice endpoint. Verify that the request is rejected if the service's own authentication middleware requires a service token or valid `X-User-Id`.
  - **Expired User Token:** Use an expired user token at the API Gateway. Ensure the API Gateway rejects it.
  - **Over-privileged Service Token:** Define granular permissions for service tokens. Test that a service (e.g., Order Service) cannot use its service token to access resources in another service (e.g., Admin Service's admin-only endpoints) that it is not explicitly authorized for.
  - **Tampered `X-User-Id` Header:** Simulate a request to an internal service with a valid service token but a _forged_ `X-User-Id` header (without going through the API Gateway). The service should reject this as `X-User-Id` should ideally be cryptographically signed by the API Gateway or be accompanied by additional verification if direct access is allowed. This highlights why the API Gateway validation is crucial.

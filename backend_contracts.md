# Backend Contract Extraction Summary

## Order Service

### Entities & DTOs
- Address    - DTOs returned by APIs: The `Address` interface itself.    - Required fields: `id`, `customerId`, `address`, `isDefault`, `createdAt`.    - Optional fields: `label`, `latitude`, `longitude`.
- CustomerOrder
    - DTOs returned by APIs: The `CustomerOrder` interface itself.
    - Required fields: `id`, `customerId`, `status`, `subtotal`, `deliveryFee`, `commissionAmount`, `totalAmount`, `deliveryAddress`, `createdAt`, `updatedAt`.
    - Optional fields: `deliveryLatitude`, `deliveryLongitude`, `customerNotes`, `cancellationReason`.
- VendorOrder
    - DTOs returned by APIs: The `VendorOrder` interface itself.
    - Required fields: `id`, `customerOrderId`, `vendorId`, `status`, `subtotal`, `commissionAmount`, `totalAmount`, `createdAt`, `updatedAt`.
    - Optional fields: `deliveryId`, `cancellationReason`.
- VendorOrderItem
    - DTOs returned by APIs: The `VendorOrderItem` interface itself.
    - Required fields: `id`, `vendorOrderId`, `productId`, `productName`, `quantity`, `unitPrice`, `totalPrice`.
    - Optional fields: None.
- OrderWithItems (Composite DTO)
    - Combines `CustomerOrder` with an array of `VendorOrder`s, each including their `VendorOrderItem`s.
- CreateOrderDto
    - Fields: `customerId`, `items` (array of `CreateOrderItemDto`), `deliveryAddress`, `deliveryLatitude` (optional), `deliveryLongitude` (optional), `customerNotes` (optional).
- UpdateCustomerOrderStatusDto
    - Fields: `status`, `notes` (optional).
- UpdateVendorOrderStatusDto
    - Fields: `status`, `notes` (optional).
- ProposeChangesDto
    - Fields: `itemId`, `type` ("QUANTITY_REDUCTION" | "UNAVAILABLE"), `proposedQuantity` (optional).

### Status Enums
- Address    - DTOs returned by APIs: The `Address` interface itself.    - Required fields: `id`, `customerId`, `address`, `isDefault`, `createdAt`.    - Optional fields: `label`, `latitude`, `longitude`.
- CustomerOrderStatus (from @city-market/shared)
- VendorOrderStatus (from @city-market/shared)
- ProposalType (LOCAL in order-item-proposal.entity.ts - needs to be moved to shared)
- ProposalStatus (LOCAL in order-item-proposal.entity.ts - needs to be moved to shared)

### Event Payload Structures
- EventType.VENDOR_ORDER_CREATED: `{ vendorOrderId, vendorId, customerOrderId }`
- EventType.ORDER_CREATED: `{ customerOrderId, customerId }`
- EventType.VENDOR_ORDER_PROPOSED: `{ vendorOrderId, proposalId, customerOrderId, vendorId }`
- EventType.VENDOR_ORDER_CONFIRMED: `{ vendorOrderId, customerOrderId, vendorId }`
- EventType.ORDER_PICKED_UP: `{ vendorOrderId, customerOrderId, vendorId, status }` (used for VendorOrderStatus.PICKED_UP)
- EventType.ORDER_ON_THE_WAY: `{ vendorOrderId, customerOrderId, vendorId, status }` (used for VendorOrderStatus.ON_THE_WAY)
- EventType.ORDER_DELIVERED: `{ vendorOrderId, customerOrderId, vendorId, status }` (used for VendorOrderStatus.DELIVERED)
- EventType.PROPOSAL_REJECTED: `{ proposalId, vendorOrderId, customerOrderId, vendorId, customerId }`
- EventType.ORDER_CANCELLED: `{ customerOrderId, customerId }`
- EventType.VENDOR_ORDER_CANCELLED: `{ vendorOrderId, customerOrderId, vendorId }`
- EventType.ORDER_READY: `{ customerOrderId, status, customerId }`

### API Endpoints (from order.controller.ts)
- `POST /orders`: Creates a new order.
- `GET /orders/:id`: Gets an order by ID.
- `GET /orders/vendor-orders/:id`: Gets a vendor order by ID.
- `POST /orders/vendor-orders/:id/accept`: Accepts a vendor order.
- `POST /orders/vendor-orders/:id/propose-changes`: Proposes changes to a vendor order.
- `PUT /orders/vendor-orders/:id/status`: Updates a vendor order's status.
- `POST /orders/proposals/:id/accept`: Accepts a proposal.
- `POST /orders/proposals/:id/reject`: Rejects a proposal.
- `GET /orders/my-orders`: Gets the current user's orders.
- `GET /orders/vendor/:vendorId`: Gets orders for a specific vendor.
- `GET /orders`: Gets all orders (Admin).
- `PUT /orders/:id/status`: Updates a customer order's status.

## Delivery Service

### Entities & DTOs
- Delivery
    - DTOs returned by APIs: The `Delivery` interface itself.
    - Required fields: `id`, `customerOrderId`, `status`, `pickupLocations`, `deliveryAddress`, `createdAt`, `updatedAt`.
    - Optional fields: `vendorOrderId`, `courierId`, `pickupLatitude`, `pickupLongitude`, `deliveryLatitude`, `deliveryLongitude`, `assignedAt`, `pickedUpAt`, `deliveredAt`, `notes`.
- Courier
    - DTOs returned by APIs: The `Courier` interface itself.
    - Required fields: `id`, `userId`, `fullName`, `phone`, `vehicleType`, `licensePlate`, `isAvailable`, `isActive`, `rating`, `totalDeliveries`, `createdAt`, `updatedAt`.
    - Optional fields: None.
- CreateDeliveryDto
    - Fields: `customerOrderId`, `vendorOrderId` (optional), `pickupLocations`, `deliveryAddress`, `pickupLatitude` (optional), `pickupLongitude` (optional), `deliveryLatitude` (optional), `deliveryLongitude` (optional).
- AssignCourierDto
    - Fields: `courierId`.
- UpdateDeliveryStatusDto
    - Fields: `status`, `vendorOrderId`, `notes` (optional).
- RegisterCourierDto
    - Fields: `userId`, `fullName`, `phone`, `vehicleType`, `licensePlate`.

### Status Enums
- DeliveryStatus (from @city-market/shared)

### Event Payload Structures
- EventType.DELIVERY_CREATED: `{ deliveryId, vendorOrderId, customerOrderId, customerId, vendorId }`
- EventType.ORDER_PICKED_UP: `{ deliveryId, customerOrderId, vendorOrderId }` (also used in order-service)
- EventType.ORDER_ON_THE_WAY: `{ deliveryId, customerOrderId, vendorOrderId }` (also used in order-service)
- EventType.ORDER_DELIVERED: `{ deliveryId, customerOrderId, vendorOrderId }` (also used in order-service)
- EventType.COURIER_ASSIGNED: `{ deliveryId, courierId, customerOrderId }`

### API Endpoints (from delivery.controller.ts)
#### Courier Management
- `POST /couriers`: Registers a new courier.
- `GET /couriers`: Gets all couriers.
- `GET /couriers/me`: Gets the currently logged-in courier's profile.
- `GET /couriers/available`: Gets available couriers.
- `PUT /couriers/:id`: Updates a courier's profile.
- `PUT /couriers/:id/availability`: Updates a courier's availability.
#### Delivery Management
- `POST /deliveries`: Creates a new delivery.
- `GET /deliveries/:id`: Gets a delivery by ID.
- `GET /deliveries/pending`: Gets pending deliveries.
- `GET /deliveries/my-deliveries`: Gets the current courier's deliveries.
- `POST /deliveries/:id/assign`: Assigns a courier to a delivery.
- `PUT /deliveries/:id/status`: Updates a delivery's status.
- `GET /deliveries`: Gets all deliveries (for Admin).

## User Service

### Entities & DTOs
- Address    - DTOs returned by APIs: The `Address` interface itself.    - Required fields: `id`, `customerId`, `address`, `isDefault`, `createdAt`.    - Optional fields: `label`, `latitude`, `longitude`.
- Customer
    - DTOs returned by APIs: The `Customer` interface itself.
    - Required fields: `id`, `userId`, `fullName`, `createdAt`, `updatedAt`.
    - Optional fields: `phone`.
- Address
    - DTOs returned by APIs: The `Address` interface itself.
    - Required fields: `id`, `customerId`, `address`, `isDefault`, `createdAt`.
    - Optional fields: `label`, `latitude`, `longitude`.
- CreateCustomerDto
    - Fields: `userId`, `fullName`, `phone` (optional).
- UpdateCustomerDto
    - Fields: `fullName` (optional), `phone` (optional).
- CreateAddressDto
    - Fields: `label` (optional), `address`, `latitude` (optional), `longitude` (optional), `isDefault` (optional).

### Status Enums
- None specifically for this service; relies on shared types.

### Event Payload Structures
- No events are explicitly published by this service.

### API Endpoints (from user.controller.ts)
- `POST /customers`: Creates a customer profile.
- `GET /customers/me`: Gets the profile of the logged-in user.
- `PUT /customers/me`: Updates the profile of the logged-in user.
- `POST /customers/addresses`: Adds a new address for the logged-in user.
- `GET /customers/addresses`: Gets all addresses for the logged-in user.
- `DELETE /customers/addresses/:addressId`: Deletes an address.

---
**Note on local enums:** `ProposalType` and `ProposalStatus` are currently defined locally in `order-service/src/core/entities/order-item-proposal.entity.ts`. These should be moved to `@city-market/shared/enums` in Phase 4.

## Vendor Service

### Entities & DTOs
- Vendor
    - DTOs returned by APIs: The `Vendor` interface itself.
    - Required fields: `id`, `userId`, `shopName`, `phone`, `address`, `status`, `commissionRate`, `isActive`, `createdAt`, `updatedAt`.
    - Optional fields: `shopDescription`, `latitude`, `longitude`, `storeImage`.
- WorkingHours
    - DTOs returned by APIs: The `WorkingHours` interface itself.
    - Required fields: `id`, `vendorId`, `dayOfWeek`, `openTime`, `closeTime`, `isOpen`.
    - Optional fields: None.
- CreateVendorDto
    - Fields: `userId`, `shopName`, `shopDescription` (optional), `phone`, `address`, `latitude` (optional), `longitude` (optional).
- UpdateVendorDto
    - Fields: `shopName` (optional), `shopDescription` (optional), `phone` (optional), `address` (optional), `latitude` (optional), `longitude` (optional).
- UpdateStatusDto
    - Fields: `status`.
- SetWorkingHoursDto
    - Fields: `dayOfWeek`, `openTime`, `closeTime`, `isOpen`.

### Status Enums
- ShopStatus (from @city-market/shared)

### Event Payload Structures
- EventType.VENDOR_REGISTERED: `{ vendorId, userId }`

### API Endpoints (from vendor.controller.ts)
- `POST /vendors`: Creates a new vendor.
- `GET /vendors/:id`: Gets a vendor by ID.
- `GET /vendors/me`: Gets the currently logged-in vendor's profile.
- `GET /vendors`: Gets all vendors.
- `GET /vendors/open`: Gets all open vendors.
- `PUT /vendors/:id`: Updates a vendor's profile.
- `PATCH /vendors/:id/status`: Updates a vendor's status.
- `POST /vendors/:id/working-hours`: Sets a vendor's working hours.
- `GET /vendors/:id/working-hours`: Gets a vendor's working hours.
- `POST /vendors/:id/image`: Uploads a store image for a vendor.

## Admin Service

### Entities & DTOs
- DashboardStats
    - Fields: `totalOrders`, `totalVendors`, `totalCouriers`, `totalUsers`, `revenueToday`.

### Status Enums
- No custom enums; relies on status strings from other services (e.g., `CustomerOrderStatus`, `ShopStatus` for updates).

### Event Payload Structures
- No events are explicitly published by this service.

### API Endpoints (from admin.controller.ts)
- `GET /admin/dashboard`: Retrieves dashboard statistics.
- `GET /admin/orders`: Gets all orders.
- `GET /admin/vendors`: Gets all vendors.
- `PUT /admin/vendors/:vendorId/commission`: Updates a vendor's commission rate.
- `PATCH /admin/vendors/:vendorId/suspend`: Suspends a vendor.
- `GET /admin/couriers`: Gets all couriers.
- `PATCH /admin/couriers/:courierId/deactivate`: Deactivates a courier.
- `GET /admin/users`: Gets all users.
- `GET /admin/users/:id`: Gets a user by ID.
- `PATCH /admin/users/:id/status`: Updates a user's status.
- `GET /admin/vendors/:id`: Gets a vendor by ID.
- `PATCH /admin/vendors/:id/status`: Updates a vendor's status.
- `GET /admin/orders/:id`: Gets an order by ID.
- `PATCH /admin/orders/:id/status`: Updates an order's status.
- `GET /admin/deliveries`: Gets all deliveries.
- `GET /admin/couriers/available`: Gets available couriers.
- `GET /admin/revenue`: Gets revenue information (currently mock data from service).
- `GET /admin/payouts`: Gets payouts information (currently mock data from service).

## Payment Service

### Entities & DTOs
- No explicit entities found in `core/entities`.
- No explicit DTOs found in `core/dto`.

### Status Enums
- None observed.

### Event Payload Structures
- No events are explicitly published by this service.

### API Endpoints
- No direct API endpoints exposed via `presentation/controllers`.

**Observation:** This service appears to be an internal service, likely responsible for processing payments initiated by other services (e.g., `order-service`) or integrating with external payment gateways. It does not expose its own public API endpoints for direct consumption by frontends. The `admin-service` currently mocks responses for `/admin/revenue` and `/admin/payouts`, indicating that the payment-related functionality is either not yet fully implemented or not exposed for direct querying by the `admin-service` as expected.

## Catalog Service

### Entities & DTOs
- Product
    - DTOs returned by APIs: The `Product` interface itself.
    - Required fields: `id`, `vendorId`, `name`, `price`, `stockQuantity`, `isAvailable`, `createdAt`, `updatedAt`.
    - Optional fields: `categoryId`, `categoryName`, `description`, `imageUrl`.
- Category
    - DTOs returned by APIs: The `Category` interface itself.
    - Required fields: `id`, `name`, `createdAt`.
    - Optional fields: `description`.
- CreateProductDto
    - Fields: `vendorId`, `categoryId` (optional), `name`, `description` (optional), `price`, `stockQuantity`, `imageUrl` (optional).
- UpdateProductDto
    - Fields: `name` (optional), `description` (optional), `price` (optional), `stockQuantity` (optional), `imageUrl` (optional), `isAvailable` (optional).
- ProductFilter
    - Fields: `vendorId` (optional), `categoryId` (optional), `search` (optional), `minPrice` (optional), `maxPrice` (optional), `available` (optional).
- CreateCategoryDto
    - Fields: `name`, `description` (optional). (Defined in service, should be a separate DTO file).

### Status Enums
- No custom enums.

### Event Payload Structures
- No events are explicitly published by this service.

### API Endpoints (from product.controller.ts)
- `POST /products`: Creates a new product.
- `GET /products/:id`: Gets a product by ID.
- `GET /products/vendor/:vendorId`: Gets products by vendor.
- `GET /products/category/:categoryId`: Gets products by category.
- `GET /products/search`: Searches for products with various filters.
- `PUT /products/:id`: Updates a product.
- `PATCH /products/:id/stock`: Updates a product's stock.
- `DELETE /products/:id`: Deletes a product.
- `POST /products/:id/image`: Uploads a product image.

### API Endpoints (from category.controller.ts)
- `POST /categories`: Creates a new category.
- `GET /categories`: Gets all categories.
- `GET /categories/:id`: Gets a category by ID.
- `PUT /categories/:id`: Updates a category.
- `DELETE /categories/:id`: Deletes a category.

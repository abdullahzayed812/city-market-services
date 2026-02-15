
## Summary of Changes

**1) Updated getVendorOrders implementation (Backend)**

The `getVendorOrders` method in `services/order-service/src/application/services/order.service.ts` has been updated to return `VendorOrderWithItemsDto[]`. This was achieved by:
-   Adding a new method `findByVendorWithItems` to `services/order-service/src/core/interfaces/vendor-order.repository.ts` and its implementation in `services/order-service/src/infrastructure/repositories/vendor-order.repository.ts`. This method performs a `LEFT JOIN` between `vendor_orders` and `vendor_order_items` tables to fetch all necessary data in a single query, thus avoiding the N+1 query problem. The results are then mapped and grouped into `VendorOrderWithItemsDto` objects.
-   The `getVendorOrders` method in the `OrderService` now calls this new repository method.

**2) Updated DTO shape**

A new DTO, `VendorOrderWithItemsDto`, has been added to `shared/src/interfaces/order-interfaces.ts`.

```typescript
export interface VendorOrderWithItemsDto extends VendorOrder {
  items: VendorOrderItem[];
}
```

This DTO extends the existing `VendorOrder` interface to include an array of `VendorOrderItem` objects, representing the items associated with a vendor order.

**3) Vendor dashboard changes summary**

-   **Data Layer (`web/vendor-dashboard/src/services/api/order.service.ts`):**
    -   The `getVendorOrders` API call now correctly uses `ApiResponse<VendorOrderWithItemsDto[]>`.
    -   The `proposeChanges` method has been updated to accept an array of `ProposeChangesDto` to match the backend API.
-   **UI Rendering (`web/vendor-dashboard/src/pages/Orders.tsx`):**
    -   The `Orders` component now uses the `VendorOrderWithItemsDto` type for displaying orders.
    -   A `Collapsible` component has been integrated to display the `VendorOrderItem` details for each `VendorOrder` in a nested table, fulfilling the requirement of grouping items under their parent order.
    -   Basic handling for "no items" in an order has been implemented.
    -   A basic error display for API failures has been added.
    -   State management for a new `ProposalDialog` has been added.
-   **Proposal Capability (`web/vendor-dashboard/src/components/ui/ProposalDialog.tsx` & `web/vendor-dashboard/src/pages/Orders.tsx`):**
    -   A new `ProposalDialog` component has been created to allow vendors to send proposals. This dialog enables reducing quantity or marking items as unavailable.
    -   A "Send Proposal" button is now conditionally rendered for `PENDING` orders in the `Orders.tsx` component, which opens the `ProposalDialog`.
    -   The `useOrders` hook now exposes a `proposeChanges` mutation, which is called when the proposal form is submitted.
-   **Order Status Changes:** The existing dropdown menu logic in `Orders.tsx` already handles valid status transitions, leveraging the backend's validation. No changes were required in the frontend for this specific requirement.

**4) Socket integration verification**

The `useEffect` hook in `web/vendor-dashboard/src/hooks/useOrders.ts` has been updated to listen for two new socket events: `VENDOR_ORDER_UPDATED` and `PROPOSAL_STATUS_UPDATED`. Upon receiving these events, `react-query`'s cache is invalidated, triggering a re-fetch of orders to ensure the UI reflects the latest changes. Proper cleanup on unmount is already in place.

**5) Type safety confirmation**

Strict type safety has been maintained throughout the changes.
-   The new `VendorOrderWithItemsDto` is fully typed.
-   All new and modified components, hooks, and services use explicit TypeScript types, avoiding the use of `any`.
-   Enum comparisons (`VendorOrderStatus`) and optional chaining are used appropriately.

**6) Any potential performance risk**

-   **Backend:** The primary performance improvement comes from refactoring `getVendorOrders` to use a `LEFT JOIN` in the repository, eliminating the N+1 query problem. This significantly reduces the number of database roundtrips, especially for vendors with many orders and items. Pagination is also handled efficiently within the SQL query.
-   **Frontend:** The `react-query` library efficiently caches and manages data, preventing unnecessary API calls. The UI rendering of collapsible items might introduce a slight increase in DOM elements, but it's not expected to be a significant performance bottleneck for typical order volumes. The use of `useEffect` for socket subscriptions includes proper cleanup, preventing memory leaks.
-   **Overall:** The changes are designed to improve performance by optimizing database interactions and maintaining efficient frontend data management. No new significant performance risks are anticipated.

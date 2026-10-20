import { Server } from "socket.io";
import { EventType, UserRole } from "@city-market/shared";
import { rabbitMQBus } from "@city-market/shared/node";
import axios from "axios";
import { config, websocketGatewayAuthenticator } from "./config/env";

// Helper function to fetch full order details if needed
// Using 'any' for now to avoid cross-service type dependencies
const getFullOrderDetails = async (orderId: string): Promise<any | null> => {
  try {
    const serviceToken = await websocketGatewayAuthenticator.getServiceToken();
    const response = await axios.get(`${config.orderServiceUrl}/customer-orders/${orderId}`, {
      headers: {
        Authorization: `Bearer ${serviceToken}`,
      },
    }); // Endpoint is /orders/:id
    return response?.data?.data; // Expects { order: CustomerOrder, vendorOrders: VendorOrder[] }
  } catch (error: any) {
    console.warn(`Failed to fetch full order details for ${orderId}:`, error.message);
    return null;
  }
};

// Events that change the shared pool of unclaimed deliveries. Every office (and, for some,
// every freelancer) needs to refresh its list, but only gets { deliveryId }: no customer
// or order details leak to offices that don't own the delivery (S6).
const OFFICE_POOL_EVENTS = new Set<string>([
  EventType.DELIVERY_CREATED,
  EventType.DELIVERY_ACCEPTED,
  EventType.DELIVERY_CLAIMED,
  EventType.DELIVERY_RETURNED_TO_POOL,
  EventType.SLA_DELIVERY_ACCEPTANCE_EXPIRED,
  EventType.SLA_COURIER_ASSIGNMENT_EXPIRED,
]);
const FREELANCE_POOL_EVENTS = new Set<string>([
  EventType.DELIVERY_OPEN_TO_FREELANCE,
  EventType.DELIVERY_ACCEPTED,
  EventType.DELIVERY_CLAIMED,
  EventType.DELIVERY_RETURNED_TO_POOL,
  EventType.SLA_DELIVERY_ACCEPTANCE_EXPIRED,
]);
// Pool events carry no customer; skip the order lookup for them
const NO_ENRICHMENT_EVENTS = new Set<string>([
  EventType.DELIVERY_OPEN_TO_FREELANCE,
  EventType.DELIVERY_CLAIMED,
  EventType.DELIVERY_RETURNED_TO_POOL,
  EventType.COURIER_APPROVAL_UPDATED,
  EventType.OFFICE_APPROVAL_UPDATED,
  EventType.VENDOR_APPROVAL_UPDATED,
  EventType.PRODUCT_SUBMISSION_REVIEWED,
  EventType.PRODUCT_SUBMISSION_CREATED,
  EventType.OFFICE_REVIEW_REQUESTED,
]);

// A user's own notifications: only that user's sockets (any app they're signed in to)
const PERSONAL_EVENTS = new Set<string>([EventType.NOTIFICATION_CREATED, EventType.NOTIFICATION_READ]);

// Routes one RabbitMQ event to the socket rooms allowed to see it
export const createEventHandler = (io: Pick<Server, "to">, fetchOrderDetails: (orderId: string) => Promise<any | null> = getFullOrderDetails) => {
  return async (event: any) => {
    console.log(`Received event: ${event.type}`);
    let { type, payload } = event; // Use let for payload as we might modify it

    // Never broadcast: carries one user's notification
    if (PERSONAL_EVENTS.has(type)) {
      if (payload?.userId) io.to(`user:${payload.userId}`).emit(type, { ...payload, eventId: event.id });
      return;
    }
    // Admin-made changes refresh the other admins' screens only
    if (type === EventType.ADMIN_DATA_CHANGED) {
      io.to(`role:${UserRole.ADMIN}`).emit(type, { ...payload, eventId: event.id });
      return;
    }

    // --- ENRICHMENT LOGIC ---
    // If a customerOrderId is present, ensure we have full order details for routing
    if (payload.customerOrderId && !NO_ENRICHMENT_EVENTS.has(type) && (!payload.customerOrder || !payload.vendorOrders)) {
      const fullOrderDetails = await fetchOrderDetails(payload.customerOrderId);
      if (fullOrderDetails) {
        payload.customerOrder = fullOrderDetails.order; // Store the CustomerOrder entity
        payload.vendorOrders = fullOrderDetails.vendorOrders; // Store the array of VendorOrder entities
        payload.customerId = fullOrderDetails.order.customerId; // Ensure customerId is present
      }
    }

    // --- ROUTING LOGIC ---

    // 1. Broadcast to Admin (Admins get all events). The event id lets admin apps drop duplicates.
    io.to(`role:${UserRole.ADMIN}`).emit(type, { ...payload, eventId: event.id });

    // 2. Broadcast to Customer (Customers get events related to their customer order)
    if (payload.customerId) {
      io.to(`user:${payload.customerId}`).emit(type, payload);
    }

    // 3. Broadcast to Vendors (Vendors get events related to their specific vendor orders)
    // This is the critical part to fix.
    // Events might be CustomerOrder-level or VendorOrder-level.
    if (payload.vendorId) {
      // This indicates a VendorOrder-specific event (e.g., VENDOR_ORDER_CREATED, VENDOR_ORDER_CONFIRMED)
      // Ensure vendor-specific payload doesn't leak customer order's other vendor details
      const vendorSpecificPayload = { ...payload }; // Shallow copy
      if (vendorSpecificPayload.customerOrder && vendorSpecificPayload.vendorOrders) {
        // Filter to include only the relevant vendorOrder if it's a customer-order level payload with vendorId
        const specificVendorOrder = vendorSpecificPayload.vendorOrders.find(
          (vo: any) => vo.id === vendorSpecificPayload.vendorOrderId
        );
        vendorSpecificPayload.vendorOrders = specificVendorOrder ? [specificVendorOrder] : [];
      }
      io.to(`vendor:${payload.vendorId}`).emit(type, vendorSpecificPayload);
    } else if (payload.vendorOrders && Array.isArray(payload.vendorOrders)) {
      // This indicates a CustomerOrder-level event affecting multiple vendors
      payload.vendorOrders.forEach((vendorOrder: any) => {
        // Using any for vendorOrder
        const vendorSpecificPayload = {
          ...payload, // Copy common fields
          vendorOrder: vendorOrder, // Include the specific vendor order
          vendorOrders: undefined, // Clear the array from the common payload for vendor-specific broadcast
        };
        io.to(`vendor:${vendorOrder.vendorId}`).emit(type, vendorSpecificPayload);
      });
    }

    // 4. Broadcast to Courier (Couriers get events related to their assigned deliveries)
    if (payload.courierId) {
      io.to(`courier:${payload.courierId}`).emit(type, payload);
    }

    // 5. Delivery offices (S6): full payload to the owning office only; a slim
    // notice to every office when the shared pool changes.
    if (payload.deliveryOfficeId) {
      io.to(`office:${payload.deliveryOfficeId}`).emit(type, payload);
    }
    if (OFFICE_POOL_EVENTS.has(type)) {
      io.to(`role:${UserRole.DELIVERY_MANAGER}`).emit(type, { deliveryId: payload.deliveryId });
    }

    // 6. Freelancers: the pool changed (new job, taken, or back again)
    if (FREELANCE_POOL_EVENTS.has(type)) {
      io.to("courier:freelance").emit(type, { deliveryId: payload.deliveryId });
    }

    // 7. Approval decisions go straight to that courier / office manager
    if (type === EventType.COURIER_APPROVAL_UPDATED && payload.courierUserId) {
      io.to(`user:${payload.courierUserId}`).emit(type, { approvalStatus: payload.approvalStatus });
      // The manager who requested this office courier refreshes their courier list
      if (payload.officeUserId) {
        io.to(`user:${payload.officeUserId}`).emit(type, { courierId: payload.courierId, approvalStatus: payload.approvalStatus });
      }
    }
    if (type === EventType.OFFICE_APPROVAL_UPDATED && payload.officeUserId) {
      io.to(`user:${payload.officeUserId}`).emit(type, { approvalStatus: payload.approvalStatus });
    }
    // The merchant's app / dashboard refetches its store and leaves (or enters) the pending screen
    if (type === EventType.VENDOR_APPROVAL_UPDATED && payload.vendorUserId) {
      io.to(`user:${payload.vendorUserId}`).emit(type, { approvalStatus: payload.approvalStatus });
    }
    // The merchant's proposal list / detail refetches
    if (type === EventType.PRODUCT_SUBMISSION_REVIEWED && payload.vendorUserId) {
      io.to(`user:${payload.vendorUserId}`).emit(type, { submissionId: payload.submissionId, status: payload.status });
    }
  };
};

export const setupEventConsumer = async (io: Server) => {
  const channelName = "websocket-gateway-queue";
  const handleEvent = createEventHandler(io);

  // Subscribe to all event types
  for (const type of Object.values(EventType)) {
    await rabbitMQBus.subscribe(type as EventType, channelName, async (event) => {
      if (event.type === type) {
        // Redundant check, but harmless
        await handleEvent(event);
      }
    });
  }
};

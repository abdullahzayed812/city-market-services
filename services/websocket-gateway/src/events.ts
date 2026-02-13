import { Server } from "socket.io";
import { rabbitMQBus, EventType, UserRole } from "@city-market/shared"; // Removed CustomerOrder, VendorOrder imports
import axios from "axios";

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || "http://localhost:3005";

// Helper function to fetch full order details if needed
// Using 'any' for now to avoid cross-service type dependencies
const getFullOrderDetails = async (orderId: string): Promise<any | null> => {
  try {
    const response = await axios.get(`${ORDER_SERVICE_URL}/orders/${orderId}`); // Endpoint is /orders/:id
    return response.data; // Expects { order: CustomerOrder, vendorOrders: VendorOrder[] }
  } catch (error: any) {
    console.warn(`Failed to fetch full order details for ${orderId}:`, error.message);
    return null;
  }
};

export const setupEventConsumer = async (io: Server) => {
  const channelName = "websocket-gateway-queue";

  const handleEvent = async (event: any) => {
    console.log(`Received event: ${event.type}`, event.payload);
    let { type, payload } = event; // Use let for payload as we might modify it

    // --- ENRICHMENT LOGIC ---
    // If a customerOrderId is present, ensure we have full order details for routing
    if (payload.customerOrderId && (!payload.customerOrder || !payload.vendorOrders)) {
      const fullOrderDetails = await getFullOrderDetails(payload.customerOrderId);
      if (fullOrderDetails) {
        payload.customerOrder = fullOrderDetails.order; // Store the CustomerOrder entity
        payload.vendorOrders = fullOrderDetails.vendorOrders; // Store the array of VendorOrder entities
        payload.customerId = fullOrderDetails.order.customerId; // Ensure customerId is present
      }
    }

    // --- ROUTING LOGIC ---

    // 1. Broadcast to Admin (Admins get all events)
    io.to(`role:${UserRole.ADMIN}`).emit(type, payload);

    // 2. Broadcast to Customer (Customers get events related to their customer order)
    if (payload.customerId) {
      io.to(`user:${payload.customerId}`).emit(type, payload);
    }

    // 3. Broadcast to Vendors (Vendors get events related to their specific vendor orders)
    // This is the critical part to fix.
    // Events might be CustomerOrder-level or VendorOrder-level.
    if (payload.vendorId) { // This indicates a VendorOrder-specific event (e.g., VENDOR_ORDER_CREATED, VENDOR_ORDER_CONFIRMED)
        // Ensure vendor-specific payload doesn't leak customer order's other vendor details
        const vendorSpecificPayload = { ...payload }; // Shallow copy
        if (vendorSpecificPayload.customerOrder && vendorSpecificPayload.vendorOrders) {
            // Filter to include only the relevant vendorOrder if it's a customer-order level payload with vendorId
            const specificVendorOrder = vendorSpecificPayload.vendorOrders.find((vo: any) => vo.id === vendorSpecificPayload.vendorOrderId);
            vendorSpecificPayload.vendorOrders = specificVendorOrder ? [specificVendorOrder] : [];
        }
      io.to(`vendor:${payload.vendorId}`).emit(type, vendorSpecificPayload);
    } else if (payload.vendorOrders && Array.isArray(payload.vendorOrders)) { // This indicates a CustomerOrder-level event affecting multiple vendors
      payload.vendorOrders.forEach((vendorOrder: any) => { // Using any for vendorOrder
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

    // 5. Broadcast to Delivery Manager (Delivery Managers get all order and delivery related events)
    io.to(`role:${UserRole.DELIVERY_MANAGER}`).emit(type, payload);
  };

  // Subscribe to all event types
  for (const type of Object.values(EventType)) {
    await rabbitMQBus.subscribe(type as EventType, channelName, async (event) => {
      if (event.type === type) { // Redundant check, but harmless
        await handleEvent(event);
      }
    });
  }
};

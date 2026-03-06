export interface OrderInfo {
    id: string;
    customerId: string;
    status: string;
    vendorOrders: Array<{
        vendorId: string;
    }>;
}

export interface IOrderClient {
    getOrder(orderId: string, userId?: string): Promise<OrderInfo | null>;
}

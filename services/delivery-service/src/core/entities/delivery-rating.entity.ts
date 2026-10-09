export interface DeliveryRating {
  id: string;
  deliveryId: string;
  customerOrderId: string;
  customerId: string;
  courierId: string;
  // Set when an office handled the delivery; the rating then counts toward the office too
  deliveryOfficeId: string | null;
  stars: number;
  comment: string | null;
  createdAt: Date;
}

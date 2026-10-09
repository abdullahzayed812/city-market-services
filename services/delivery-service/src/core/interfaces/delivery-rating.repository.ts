import { DeliveryRating } from "../entities/delivery-rating.entity";

export interface DeliveryRatingFilter {
  courierId?: string;
  deliveryOfficeId?: string;
}

// A rating with who/where it was for, for review lists
export interface DeliveryRatingView extends DeliveryRating {
  courierName: string | null;
  officeName: string | null;
}

export interface DeliveryRatingSummary {
  averageRating: number | null;
  totalRatings: number;
  // stars -> how many ratings gave that many
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface IDeliveryRatingRepository {
  create(rating: DeliveryRating, connection?: any): Promise<void>;
  findByDeliveryId(deliveryId: string, connection?: any): Promise<DeliveryRating | null>;
  findByDeliveryIds(deliveryIds: string[]): Promise<DeliveryRating[]>;
  list(filter: DeliveryRatingFilter, limit: number, offset: number): Promise<DeliveryRatingView[]>;
  summary(filter: DeliveryRatingFilter): Promise<DeliveryRatingSummary>;
  // Recompute the stored average + count from all ratings
  refreshCourierRating(courierId: string, connection?: any): Promise<void>;
  refreshOfficeRating(officeId: string, connection?: any): Promise<void>;
}

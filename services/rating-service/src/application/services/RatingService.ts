import { randomUUID } from "crypto";
import { PoolConnection } from "mysql2/promise";
import { ValidationError, NotFoundError, CustomerOrderStatus } from "@city-market/shared";
import { Database } from "@city-market/shared/node";
import { IRatingRepository } from "../../core/interfaces/IRatingRepository";
import { IVendorRatingSummaryRepository } from "../../core/interfaces/IVendorRatingSummaryRepository";
import { IOrderClient } from "../../core/interfaces/IOrderClient";
import { IUserClient } from "../../core/interfaces/IUserClient";
import { IVendorClient } from "../../core/interfaces/IVendorClient";
import { RatingPublisher } from "../../infrastructure/messaging/RatingPublisher";
import { CreateRatingDTO } from "../../core/dto/CreateRatingDTO";
import { Rating, VendorRatingSummary } from "../../core/entities/Rating";

export class RatingService {
  constructor(
    private ratingRepo: IRatingRepository,
    private summaryRepo: IVendorRatingSummaryRepository,
    private orderClient: IOrderClient,
    private userClient: IUserClient,
    private vendorClient: IVendorClient,
    private publisher: RatingPublisher,
    private db: Database,
  ) {}

  async createRating(dto: CreateRatingDTO, customerUserId: string): Promise<Rating> {
    let connection: PoolConnection | undefined;

    try {
      // 1. Fetch order from Order Service
      const order = await this.orderClient.getOrder(dto.orderId, customerUserId);
      if (!order) throw new NotFoundError("order_not_found");

      // 2. Validate: Order status is COMPLETED (delivered)
      if (order.status !== CustomerOrderStatus.COMPLETED) {
        throw new ValidationError("order_not_delivered");
      }

      // 3. Validate: Order.customer_id matches authenticated user
      if (order.customerId !== customerUserId) {
        throw new ValidationError("not_your_order");
      }

      // 4. Validate: vendorId belongs to this order
      const vendorInOrder = order.vendorOrders.find((vo) => vo.vendorId === dto.vendorId);
      if (!vendorInOrder) {
        throw new ValidationError("vendor_not_in_order");
      }

      // 5. Ensure rating does NOT already exist for that order and vendor
      const existingRating = await this.ratingRepo.findByOrderAndVendor(dto.orderId, dto.vendorId);
      if (existingRating) {
        throw new ValidationError("vendor_already_rated_for_this_order");
      }

      // Fetch vendor and customer info for the event
      const [vendorInfo, customerInfo] = await Promise.all([
        this.vendorClient.getVendor(dto.vendorId, customerUserId),
        this.userClient.getCustomerByUserId(customerUserId),
      ]);

      connection = await this.db.beginTransaction();

      const rating: Rating = {
        id: randomUUID(),
        orderId: dto.orderId,
        vendorId: dto.vendorId,
        customerUserId: customerUserId, // Store Auth User ID directly
        stars: dto.stars,
        comment: dto.comment,
        createdAt: new Date(),
      };

      await this.ratingRepo.create(rating, connection);

      // 6. Update vendor_rating_summary using incremental formula
      let summary = await this.summaryRepo.findByVendorIdWithLock(dto.vendorId, connection);

      if (!summary) {
        summary = {
          vendorId: dto.vendorId,
          totalRatings: 1,
          totalStars: dto.stars,
          averageRating: dto.stars,
        };
        await this.summaryRepo.create(summary, connection);
      } else {
        summary.totalRatings += 1;
        summary.totalStars += dto.stars;
        summary.averageRating = Number((summary.totalStars / summary.totalRatings).toFixed(1));
        await this.summaryRepo.update(summary, connection);
      }

      // 8. Publish events
      await this.publisher.publishRatingUpdated(dto.vendorId, summary.averageRating, summary.totalRatings);

      if (vendorInfo?.userId) {
        await this.publisher.publishReviewCreated({
          ratingId: rating.id,
          orderId: rating.orderId,
          vendorId: rating.vendorId,
          vendorUserId: vendorInfo.userId,
          customerId: rating.customerUserId,
          customerName: customerInfo?.fullName || "Anonymous",
          stars: rating.stars,
          comment: rating.comment,
        });
      }

      await this.db.commit(connection);
      return rating;
    } catch (error) {
      if (connection) await this.db.rollback(connection);
      throw error;
    }
  }

  async getVendorRating(vendorId: string): Promise<{ averageRating: number; totalRatings: number }> {
    const summary = await this.summaryRepo.findByVendorId(vendorId);
    if (!summary) {
      return { averageRating: 0, totalRatings: 0 };
    }
    return {
      averageRating: summary.averageRating,
      totalRatings: summary.totalRatings,
    };
  }

  async getVendorRatingsList(vendorId: string, limit = 10, offset = 0, currentUserId?: string): Promise<Rating[]> {
    const ratings = await this.ratingRepo.findByVendorId(vendorId, limit, offset);

    if (ratings.length === 0) return [];

    // Collect unique customer IDs to avoid redundant requests
    const uniqueCustomerUserIds = Array.from(new Set(ratings.map((r) => r.customerUserId)));

    // Fetch all customer names in a single batch request
    const customers = await this.userClient.getCustomersByIds(uniqueCustomerUserIds, currentUserId);
    const customerMap = new Map<string, string>();
    customers.forEach((c) => {
      customerMap.set(c.id, c.fullName);
      customerMap.set(c.userId, c.fullName);
    });

    // Map names back to ratings
    return ratings.map((r) => ({
      ...r,
      customerName: customerMap.get(r.customerUserId) || "Anonymous",
    }));
  }
}

import { BaseEvent, EventType } from "@city-market/shared";
import { RabbitMQBus } from "@city-market/shared/node";
import { randomUUID } from "crypto";

export class RatingPublisher {
    constructor(private eventBus: RabbitMQBus) { }

    async publishRatingUpdated(vendorId: string, averageRating: number, totalRatings: number): Promise<void> {
        const event: BaseEvent = {
            id: randomUUID(),
            type: EventType.VENDOR_RATING_UPDATED,
            timestamp: new Date(),
            payload: {
                vendorId,
                averageRating,
                totalRatings
            }
        };
        await this.eventBus.publish(event);
    }

    async publishReviewCreated(data: {
        ratingId: string;
        orderId: string;
        vendorId: string;
        vendorUserId: string;
        customerId: string;
        customerName: string;
        stars: number;
        comment?: string;
    }): Promise<void> {
        const event: BaseEvent = {
            id: randomUUID(),
            type: EventType.VENDOR_REVIEW_CREATED,
            timestamp: new Date(),
            payload: data
        };
        await this.eventBus.publish(event);
    }
}

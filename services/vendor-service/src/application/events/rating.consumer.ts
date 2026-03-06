import { BaseEvent, EventType } from "@city-market/shared";
import { VendorService } from "../services/vendor.service";
import { Logger } from "@city-market/shared/node";

export class RatingConsumer {
    constructor(private vendorService: VendorService) { }

    async handle(event: BaseEvent): Promise<void> {
        try {
            if (event.type === EventType.VENDOR_RATING_UPDATED) {
                const { vendorId, averageRating, totalRatings } = event.payload;
                await this.vendorService.updateVendorRating(vendorId, averageRating, totalRatings);
            }
        } catch (error) {
            Logger.error("Error in RatingConsumer handle", error);
        }
    }
}

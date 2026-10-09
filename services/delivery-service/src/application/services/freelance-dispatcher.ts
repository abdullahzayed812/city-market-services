import { Logger } from "@city-market/shared/node";
import { Courier } from "../../core/entities/courier.entity";
import { Delivery } from "../../core/entities/delivery.entity";
import { ICourierRepository } from "../../core/interfaces/courier.repository";
import { DeliveryPublisher } from "../../infrastructure/messaging/DeliveryPublisher";
import { haversineKm, isCoordinate } from "../../utils/geo";

export interface DispatchConfig {
  freelanceEnabled: boolean;
  officePriorityWindowMins: number;
  freelanceRadiusKm: number;
  freelanceMaxCashHeld: number;
  courierLocationStaleMins: number;
}

// Decides which freelancers can see a delivery and tells them about it.
export class FreelanceDispatcher {
  constructor(
    readonly config: DispatchConfig,
    private courierRepo: ICourierRepository,
    private publisher: DeliveryPublisher,
  ) {}

  // Distance from the courier's last known location to the first pickup, or null when
  // either side has no coordinates.
  distanceKm(courier: Pick<Courier, "lastLatitude" | "lastLongitude">, delivery: Delivery): number | null {
    const pickup = delivery.pickupLocations[0];
    if (!pickup || !isCoordinate(pickup.latitude) || !isCoordinate(pickup.longitude)) return null;
    if (!isCoordinate(courier.lastLatitude) || !isCoordinate(courier.lastLongitude)) return null;
    return haversineKm(courier.lastLatitude, courier.lastLongitude, pickup.latitude, pickup.longitude);
  }

  // A pickup without coordinates can't be filtered, so everyone sees it.
  isWithinRadius(courier: Pick<Courier, "lastLatitude" | "lastLongitude">, delivery: Delivery): boolean {
    if (this.config.freelanceRadiusKm <= 0) return true;
    const distance = this.distanceKm(courier, delivery);
    return distance === null || distance <= this.config.freelanceRadiusKm;
  }

  async notifyDeliveryOpen(delivery: Delivery): Promise<void> {
    if (!this.config.freelanceEnabled) return;
    try {
      const freelancers = await this.courierRepo.findActiveFreelancers(this.config.courierLocationStaleMins);
      const courierUserIds = freelancers.filter((c) => this.isWithinRadius(c, delivery)).map((c) => c.userId);
      await this.publisher.publishDeliveryOpenToFreelance({ deliveryId: delivery.id, courierUserIds });
      Logger.info(`[Freelance] delivery:${delivery.id} open to ${courierUserIds.length} nearby freelancer(s)`);
    } catch (error: any) {
      Logger.warn(`[Freelance] Failed to notify freelancers for delivery:${delivery.id}: ${error.message}`);
    }
  }
}

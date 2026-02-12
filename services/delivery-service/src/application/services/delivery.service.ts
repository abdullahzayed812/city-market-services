import { randomUUID } from "crypto";
import { ICourierRepository } from "../../core/interfaces/courier.repository";
import { IDeliveryRepository } from "../../core/interfaces/delivery.repository";
import { Courier } from "../../core/entities/courier.entity";
import { Delivery } from "../../core/entities/delivery.entity";
import { RegisterCourierDto, UpdateCourierDto } from "../../core/dto/courier.dto";
import { CreateDeliveryDto, AssignCourierDto, UpdateDeliveryStatusDto } from "../../core/dto/delivery.dto";
import { DeliveryStatus } from "@city-market/shared";
import { ValidationError, NotFoundError } from "@city-market/shared";
import { RabbitMQBus, EventType, Logger } from "@city-market/shared";
import { OrderHttpClient } from "../../infrastructure/http/order-http-client";
import { VendorHttpClient } from "../../infrastructure/http/vendor-http-client";

const DISTANCE_THRESHOLD_KM = 2.0;

export class DeliveryService {
  constructor(
    private courierRepo: ICourierRepository,
    private deliveryRepo: IDeliveryRepository,
    private eventBus: RabbitMQBus,
    private orderClient: OrderHttpClient,
    private vendorClient: VendorHttpClient
  ) { }

  // Courier management
  async registerCourier(dto: RegisterCourierDto): Promise<Courier> {
    const existing = await this.courierRepo.findByUserId(dto.userId);
    if (existing) {
      throw new ValidationError("Courier already registered for this user");
    }

    const courier: Courier = {
      id: randomUUID(),
      userId: dto.userId,
      fullName: dto.fullName,
      phone: dto.phone,
      vehicleType: dto.vehicleType,
      licensePlate: dto.licensePlate,
      isAvailable: true,
      isActive: true,
      rating: 5.0,
      totalDeliveries: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.courierRepo.create(courier);
  }

  async getAllCouriers(page: number = 1, limit: number = 20): Promise<Courier[]> {
    const offset = (page - 1) * limit;
    return this.courierRepo.findAll(limit, offset);
  }

  async getCourierById(id: string): Promise<Courier> {
    const courier = await this.courierRepo.findById(id);
    if (!courier) {
      throw new NotFoundError("Courier not found");
    }
    return courier;
  }

  async getAvailableCouriers(): Promise<Courier[]> {
    return this.courierRepo.findAvailable();
  }

  async updateCourier(id: string, dto: UpdateCourierDto): Promise<void> {
    await this.getCourierById(id);
    await this.courierRepo.update(id, dto);
  }

  async updateCourierAvailability(id: string, isAvailable: boolean): Promise<void> {
    await this.getCourierById(id);
    await this.courierRepo.updateAvailability(id, isAvailable);
  }

  // Delivery management
  async createDelivery(dto: CreateDeliveryDto): Promise<Delivery> {
    const delivery: Delivery = {
      id: randomUUID(),
      orderId: dto.orderId,
      status: DeliveryStatus.PENDING,
      pickupAddress: dto.pickupAddress,
      deliveryAddress: dto.deliveryAddress,
      pickupLatitude: dto.pickupLatitude,
      pickupLongitude: dto.pickupLongitude,
      deliveryLatitude: dto.deliveryLatitude,
      deliveryLongitude: dto.deliveryLongitude,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.deliveryRepo.create(delivery);
  }

  async createDeliveryFromOrder(customerOrderId: string, token?: string): Promise<Delivery[]> {
    const orderData = await this.orderClient.getOrder(customerOrderId, token);
    if (!orderData || !orderData.order) {
      throw new NotFoundError(`Customer Order ${customerOrderId} not found`);
    }

    const customerOrder = orderData.order;
    const vendorOrders = orderData.vendorOrders;

    // Fetch all vendor details
    const vendors = await Promise.all(
      vendorOrders.map(async (vo: any) => {
        const vendor = await this.vendorClient.getVendor(vo.vendorId, token);
        return { ...vo, vendorInfo: vendor };
      })
    );

    // Calculate pairwise distances between vendors
    const allFarApart = this.checkDistances(vendors);

    const createdDeliveries: Delivery[] = [];

    if (!allFarApart) {
      // Group all into ONE delivery
      // We'll use the first vendor's location as a primary pickup or just use a combined approach
      // For simplicity, we create one delivery linked to the customerOrder
      const delivery = await this.createIndividualDelivery(customerOrder, vendors, customerOrderId);
      createdDeliveries.push(delivery);

      // Link all vendor orders to this delivery
      for (const vo of vendorOrders) {
        await this.eventBus.publish({
          id: randomUUID(),
          type: EventType.DELIVERY_CREATED,
          timestamp: new Date(),
          payload: { deliveryId: delivery.id, vendorOrderId: vo.id, customerOrderId }
        });
      }
    } else {
      // Separate Delivery per VendorOrder
      for (const v of vendors) {
        const delivery = await this.createIndividualDelivery(customerOrder, [v], customerOrderId);
        createdDeliveries.push(delivery);

        await this.eventBus.publish({
          id: randomUUID(),
          type: EventType.DELIVERY_CREATED,
          timestamp: new Date(),
          payload: { deliveryId: delivery.id, vendorOrderId: v.id, customerOrderId }
        });
      }
    }

    return createdDeliveries;
  }

  private async createIndividualDelivery(customerOrder: any, vendors: any[], customerOrderId: string): Promise<Delivery> {
    // Determine pickup locations (if multiple, maybe use first or a central point)
    const primaryVendor = vendors[0];
    const pickupAddress = vendors.map(v => v.vendorInfo.address || v.vendorInfo.businessAddress).join(" | ");

    const delivery: Delivery = {
      id: randomUUID(),
      orderId: customerOrderId,
      status: DeliveryStatus.PENDING,
      pickupAddress,
      deliveryAddress: customerOrder.deliveryAddress,
      pickupLatitude: primaryVendor.vendorInfo.latitude,
      pickupLongitude: primaryVendor.vendorInfo.longitude,
      deliveryLatitude: customerOrder.deliveryLatitude,
      deliveryLongitude: customerOrder.deliveryLongitude,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.deliveryRepo.create(delivery);
  }

  private checkDistances(vendors: any[]): boolean {
    if (vendors.length <= 1) return false;

    for (let i = 0; i < vendors.length; i++) {
      for (let j = i + 1; j < vendors.length; j++) {
        const dist = this.haversineDistance(
          vendors[i].vendorInfo.latitude,
          vendors[i].vendorInfo.longitude,
          vendors[j].vendorInfo.latitude,
          vendors[j].vendorInfo.longitude
        );
        if (dist > DISTANCE_THRESHOLD_KM) return true; // At least one pair is far apart
      }
    }
    return false;
  }

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async getDeliveryById(id: string): Promise<Delivery> {
    const delivery = await this.deliveryRepo.findById(id);
    if (!delivery) {
      throw new NotFoundError("Delivery not found");
    }
    return delivery;
  }

  async updateDeliveryStatus(deliveryId: string, dto: UpdateDeliveryStatusDto): Promise<void> {
    const delivery = await this.getDeliveryById(deliveryId);

    if (!this.isValidStatusTransition(delivery.status, dto.status)) {
      throw new ValidationError(`Cannot transition from ${delivery.status} to ${dto.status}`);
    }

    const updates: Partial<Delivery> = {
      status: dto.status,
      notes: dto.notes,
    };

    if (dto.status === DeliveryStatus.PICKED_UP) {
      updates.pickedUpAt = new Date();
      await this.eventBus.publish({
        id: randomUUID(),
        type: EventType.ORDER_PICKED_UP,
        timestamp: new Date(),
        payload: { deliveryId, orderId: delivery.orderId },
      });
    }

    if (dto.status === DeliveryStatus.DELIVERED) {
      updates.deliveredAt = new Date();
      if (delivery.courierId) {
        await this.courierRepo.updateAvailability(delivery.courierId, true);
        await this.courierRepo.incrementDeliveries(delivery.courierId);
      }
      await this.eventBus.publish({
        id: randomUUID(),
        type: EventType.ORDER_DELIVERED,
        timestamp: new Date(),
        payload: { deliveryId, orderId: delivery.orderId },
      });
    }

    await this.deliveryRepo.update(deliveryId, updates);
  }

  private isValidStatusTransition(currentStatus: DeliveryStatus, newStatus: DeliveryStatus): boolean {
    const transitions: Record<string, DeliveryStatus[]> = {
      [DeliveryStatus.PENDING]: [DeliveryStatus.ASSIGNED, DeliveryStatus.FAILED],
      [DeliveryStatus.ASSIGNED]: [DeliveryStatus.PICKED_UP, DeliveryStatus.FAILED],
      [DeliveryStatus.PICKED_UP]: [DeliveryStatus.ON_THE_WAY, DeliveryStatus.FAILED],
      [DeliveryStatus.ON_THE_WAY]: [DeliveryStatus.DELIVERED, DeliveryStatus.FAILED],
      [DeliveryStatus.DELIVERED]: [],
      [DeliveryStatus.FAILED]: [],
    };

    return transitions[currentStatus]?.includes(newStatus) || false;
  }
}

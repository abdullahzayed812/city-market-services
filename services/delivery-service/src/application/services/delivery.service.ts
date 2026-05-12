import { randomUUID } from "crypto";
import { PoolConnection } from "mysql2/promise";
import { ICourierRepository } from "../../core/interfaces/courier.repository";
import { IDeliveryRepository } from "../../core/interfaces/delivery.repository";
import { IDeliveryOfficeRepository } from "../../core/interfaces/delivery-office.repository";
import { IDeliveryFeeTierRepository } from "../../core/interfaces/delivery-fee-tier.repository";
import { Courier } from "../../core/entities/courier.entity";
import { Delivery } from "../../core/entities/delivery.entity";
import { RegisterCourierDto, UpdateCourierDto } from "../../core/dto/courier.dto";
import { CreateDeliveryDto, AssignCourierDto, UpdateDeliveryStatusDto } from "../../core/dto/delivery.dto";
import { DeliveryStatus, PickupLocation, UserRole } from "@city-market/shared";
import { ValidationError, NotFoundError } from "@city-market/shared";
import { EventType } from "@city-market/shared";
import { RabbitMQBus, Logger, Database } from "@city-market/shared/node";
import { OrderHttpClient } from "../../infrastructure/http/order-http-client";
import { VendorHttpClient } from "../../infrastructure/http/vendor-http-client";
import { UserHttpClient } from "../../infrastructure/http/user-http-client";
import { DeliveryPublisher } from "../../infrastructure/messaging/DeliveryPublisher";

const DISTANCE_THRESHOLD_KM = 2.0;

export class DeliveryService {
  constructor(
    private courierRepo: ICourierRepository,
    private deliveryRepo: IDeliveryRepository,
    private publisher: DeliveryPublisher,
    private orderClient: OrderHttpClient,
    private vendorClient: VendorHttpClient,
    private userClient: UserHttpClient,
    private db: Database,
    private assignedWindowMinutes: number = 1,
    private feeTierRepo?: IDeliveryFeeTierRepository,
    private officeRepo?: IDeliveryOfficeRepository,
  ) {}

  // Courier management
  async registerCourier(dto: RegisterCourierDto): Promise<Courier> {
    const existing = await this.courierRepo.findByUserId(dto.userId);
    if (existing) {
      throw new ValidationError("courier_already_registered");
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

  async getAllCouriers(page: number = 1, limit: number = 20, userId?: string, role?: string): Promise<Courier[]> {
    const offset = (page - 1) * limit;

    if (role === UserRole.DELIVERY_MANAGER && userId && this.officeRepo) {
      const office = await this.officeRepo.findByUserId(userId);
      if (office) {
        return this.courierRepo.findByOfficeId(office.id, limit, offset);
      }
    }

    return this.courierRepo.findAll(limit, offset);
  }

  async getCourierById(id: string): Promise<Courier> {
    const courier = await this.courierRepo.findById(id);
    if (!courier) {
      throw new NotFoundError("courier_not_found");
    }
    return courier;
  }

  async getCourierByUserId(userId: string): Promise<Courier> {
    const courier = await this.courierRepo.findByUserId(userId);
    if (!courier) {
      throw new NotFoundError("courier_not_found_by_user");
    }
    return courier;
  }

  async getAvailableCouriers(userId?: string, role?: string): Promise<Courier[]> {
    if (role === UserRole.DELIVERY_MANAGER && userId && this.officeRepo) {
      const office = await this.officeRepo.findByUserId(userId);
      if (office) {
        return this.courierRepo.findAvailableByOfficeId(office.id);
      }
    }

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
  async createDelivery(dto: CreateDeliveryDto, connection?: PoolConnection): Promise<Delivery> {
    const delivery: Delivery = {
      id: randomUUID(),
      customerId: dto.customerId,
      customerOrderId: dto.customerOrderId,
      vendorOrderId: dto.vendorOrderId || "GROUPED",
      status: DeliveryStatus.PENDING,
      pickupLocations: dto.pickupLocations,
      deliveryAddress: dto.deliveryAddress,
      deliveryLatitude: dto.deliveryLatitude,
      deliveryLongitude: dto.deliveryLongitude,
      totalPrice: dto.totalPrice || 0,
      itemsCount: dto.itemsCount || 0,
      deliveryFee: dto.deliveryFee || 0,
      courierFeePercentage: dto.courierFeePercentage,
      courierFeeAmount: dto.courierFeeAmount || 0,
      officeFeeAmount: dto.officeFeeAmount || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.deliveryRepo.create(delivery, connection);
  }

  async createDeliveryFromOrder(customerOrderId: string, userId?: string, deliveryFee?: number): Promise<Delivery[]> {
    let connection: PoolConnection | undefined;
    const eventsToPublish: (() => Promise<void>)[] = [];
    const createdDeliveries: Delivery[] = [];

    try {
      connection = await this.db.beginTransaction();

      // --- STEP 2: Add Application-Level Idempotency ---
      // Check if deliveries already exist for this customerOrderId.
      // If a grouped delivery is intended, we check for any existing delivery for the customerOrderId.
      // If separate deliveries are intended, we check for each customerOrderId-vendorOrderId pair.

      const orderData = await this.orderClient.getOrder(customerOrderId, userId);
      if (!orderData || !orderData.order) {
        throw new NotFoundError(`Customer Order ${customerOrderId} not found`);
      }

      const customerOrder = orderData.order;
      const vendorOrders = orderData.vendorOrders;

      // Concurrent batch fetch of unique vendors to prevent N+1 HTTP calls
      const uniqueVendorIds = Array.from(new Set(vendorOrders.map((vo: any) => vo.vendorId)));
      const vendorDetailsArray = await Promise.all(uniqueVendorIds.map((id) => this.vendorClient.getVendor(id as string, userId)));
      const vendorMap = new Map(uniqueVendorIds.map((id, index) => [id, vendorDetailsArray[index]]));

      const vendors = vendorOrders.map((vo: any) => ({
        ...vo,
        vendorInfo: vendorMap.get(vo.vendorId),
      }));

      // Calculate pairwise distances between vendors
      const allFarApart = this.checkDistances(vendors);

      if (!allFarApart) {
        // Group all into ONE delivery
        // Check for existing grouped delivery
        const existingDeliveries = await this.deliveryRepo.findByCustomerOrderId(customerOrderId, connection); // Pass connection
        if (existingDeliveries.length > 0) {
          Logger.info(`Grouped delivery already exists for Customer Order ${customerOrderId}. Skipping creation.`);
          // If transaction was started here, commit and return existing deliveries.
          await this.db.commit(connection);
          return existingDeliveries; // Return existing deliveries to maintain idempotency
        }

        const delivery = await this.createIndividualDelivery(customerOrder, vendors, customerOrderId, undefined, connection, deliveryFee);
        createdDeliveries.push(delivery);

        // Link all vendor orders to this delivery
        // for (const vo of vendorOrders) {
        eventsToPublish.push(() =>
          this.publisher.publishDeliveryCreated({
            deliveryId: delivery.id,
            customerId: customerOrder.customerId,
            customerOrderId,
          }),
        );
        // }
      } else {
        let lastDeliveryId = "";
        // Separate Delivery per VendorOrder
        for (const v of vendors) {
          // Check for existing delivery for this specific vendor order
          const existingDelivery = await this.deliveryRepo.findByCustomerOrderAndVendorOrder(customerOrderId, v.id, connection); // Pass connection
          if (existingDelivery) {
            Logger.info(`Delivery already exists for Customer Order ${customerOrderId} and Vendor Order ${v.id}. Skipping creation.`);
            createdDeliveries.push(existingDelivery); // Add existing delivery to the list
            continue; // Skip creating new delivery
          }

          const delivery = await this.createIndividualDelivery(customerOrder, [v], customerOrderId, v, connection, deliveryFee);
          createdDeliveries.push(delivery);
          lastDeliveryId = delivery.id;

          eventsToPublish.push(() =>
            this.publisher.publishDeliveryCreated({
              deliveryId: delivery.id,
              customerId: customerOrder.customerId,
              customerOrderId,
            }),
          );
        }
      }

      await this.db.commit(connection);
    } catch (error: any) {
      if (connection) {
        await this.db.rollback(connection);
      }

      // Check if the error is a MySQL unique constraint violation
      if (error.code === "ER_DUP_ENTRY") {
        Logger.warn(`Duplicate delivery insertion attempt for Order ${customerOrderId} blocked. Resuming gracefully.`);
        // Fetch and return the deliveries that were successfully created by the concurrent request
        return this.deliveryRepo.findByCustomerOrderId(customerOrderId);
      }

      throw error;
    } finally {
      // Publish all collected events after transaction
      for (const publishFn of eventsToPublish) {
        await publishFn();
      }
    }
    return createdDeliveries;
  }

  private async createIndividualDelivery(
    customerOrder: any,
    vendors: any[],
    customerOrderId: string,
    vendorOrder?: any,
    connection?: PoolConnection,
    deliveryFee?: number,
  ): Promise<Delivery> {
    const itemsCount = vendors.reduce((sum, v) => sum + (v.items?.length || 0), 0);
    const totalPrice = vendors.reduce((sum, v) => sum + (v.totalAmount || 0), 0);

    let courierFeePercentage: number | undefined;
    let courierFeeAmount = 0;
    let officeFeeAmount = 0;

    if (deliveryFee && deliveryFee > 0 && this.feeTierRepo) {
      const tier = await this.feeTierRepo.findByAmount(deliveryFee);
      if (tier) {
        courierFeePercentage = tier.courierPercentage;
        courierFeeAmount = Number(((deliveryFee * tier.courierPercentage) / 100).toFixed(2));
        officeFeeAmount = Number(((deliveryFee * tier.officePercentage) / 100).toFixed(2));
      }
    }

    const dto: CreateDeliveryDto = {
      customerId: customerOrder.customerId,
      customerOrderId: customerOrderId,
      vendorOrderId: vendorOrder ? vendorOrder.id : undefined,
      pickupLocations: vendors.map((v) => ({
        id: randomUUID(),
        vendorOrderId: v.id,
        address: v.vendorInfo.address || v.vendorInfo.businessAddress,
        latitude: v.vendorInfo.latitude,
        longitude: v.vendorInfo.longitude,
      })),
      deliveryAddress: customerOrder.deliveryAddress,
      deliveryLatitude: customerOrder.deliveryLatitude,
      deliveryLongitude: customerOrder.deliveryLongitude,
      totalPrice,
      itemsCount,
      deliveryFee: deliveryFee || 0,
      courierFeePercentage,
      courierFeeAmount,
      officeFeeAmount,
    };

    return this.createDelivery(dto, connection);
  }

  private checkDistances(vendors: any[]): boolean {
    if (vendors.length <= 1) return false;

    for (let i = 0; i < vendors.length; i++) {
      for (let j = i + 1; j < vendors.length; j++) {
        const dist = this.haversineDistance(
          vendors[i].vendorInfo.latitude,
          vendors[i].vendorInfo.longitude,
          vendors[j].vendorInfo.latitude,
          vendors[j].vendorInfo.longitude,
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
      Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async getDeliveryById(id: string, userId?: string): Promise<Delivery> {
    const delivery = await this.deliveryRepo.findById(id);
    if (!delivery) {
      throw new NotFoundError("delivery_not_found");
    }

    try {
      const orderData = await this.orderClient.getOrder(delivery.customerOrderId, userId);
      if (orderData && orderData.vendorOrders) {
        const deliveryVendorOrderIds = delivery.pickupLocations.map((pl) => pl.vendorOrderId);
        delivery.vendorOrders = orderData.vendorOrders.filter((vo: any) => deliveryVendorOrderIds.includes(vo.id));
      }
      return delivery;
    } catch (error: any) {
      Logger.warn(`Failed to fetch order details for delivery ${id}:`, error.message);
      return delivery;
    }
  }

  async getPendingDeliveries(userId?: string): Promise<Delivery[]> {
    const deliveries = await this.deliveryRepo.findPending();
    return this.enrichDeliveriesWithOrderData(deliveries, userId);
  }

  async getCourierDeliveries(courierId: string, page: number = 1, limit: number = 20, userId?: string) {
    const offset = (page - 1) * limit;
    const rows = await this.deliveryRepo.findByCourier(courierId, limit + 1, offset);
    const hasNextPage = rows.length > limit;
    const items = await this.enrichDeliveriesWithOrderData(rows.slice(0, limit), userId);
    return { items, hasNextPage };
  }

  async getAllDeliveries(page: number = 1, limit: number = 20, userId?: string, role?: string) {
    const offset = (page - 1) * limit;

    if (role === UserRole.DELIVERY_MANAGER && userId && this.officeRepo) {
      const office = await this.officeRepo.findByUserId(userId);
      if (office) {
        const rows = await this.deliveryRepo.findForManager(office.id, limit + 1, offset);
        const hasNextPage = rows.length > limit;
        const items = await this.enrichDeliveriesWithOrderData(rows.slice(0, limit), userId);
        return { items, hasNextPage };
      }
    }

    const rows = await this.deliveryRepo.findAll(limit + 1, offset);
    const hasNextPage = rows.length > limit;
    const items = await this.enrichDeliveriesWithOrderData(rows.slice(0, limit), userId);
    return { items, hasNextPage };
  }

  private async enrichDeliveriesWithOrderData(deliveries: Delivery[], userId?: string): Promise<Delivery[]> {
    if (deliveries.length === 0) return deliveries;

    return Promise.all(
      deliveries.map(async (delivery) => {
        try {
          const [orderData, customerPhone] = await Promise.all([
            this.orderClient.getOrder(delivery.customerOrderId, userId),
            this.userClient.getCustomerPhone(delivery.customerId),
          ]);
          if (orderData && orderData.vendorOrders) {
            const deliveryVendorOrderIds = delivery.pickupLocations.map((pl) => pl.vendorOrderId);
            delivery.vendorOrders = orderData.vendorOrders.filter((vo: any) => deliveryVendorOrderIds.includes(vo.id));
          }
          if (customerPhone) {
            delivery.customerPhone = customerPhone;
          }
          return delivery;
        } catch (error: any) {
          Logger.warn(`Failed to fetch order details for delivery ${delivery.id}:`, error.message);
          return delivery;
        }
      }),
    );
  }

  async updateDeliveryStatus(deliveryId: string, dto: UpdateDeliveryStatusDto): Promise<void> {
    const delivery = await this.getDeliveryById(deliveryId);
    const vendorOrdersIds = delivery?.pickupLocations?.map((location: PickupLocation) => location?.vendorOrderId);

    if (!this.isValidStatusTransition(delivery.status, dto.status)) {
      throw new ValidationError(`Cannot transition from ${delivery.status} to ${dto.status}`);
    }

    const updates: Partial<Delivery> = {
      status: dto.status,
      notes: dto.notes,
    };

    // Store events to publish after DB update
    const eventsToPublish: (() => Promise<void>)[] = [];

    if (dto.status === DeliveryStatus.PICKED_UP) {
      updates.pickedUpAt = new Date();
      eventsToPublish.push(() =>
        this.publisher.publishOrderPickedUp({
          deliveryId,
          customerOrderId: delivery.customerOrderId,
          customerId: delivery.customerId,
          vendorOrdersIds,
        }),
      );
    } else if (dto.status === DeliveryStatus.ON_THE_WAY) {
      eventsToPublish.push(() =>
        this.publisher.publishOrderOnTheWay({
          deliveryId,
          customerOrderId: delivery.customerOrderId,
          customerId: delivery.customerId,
          vendorOrdersIds,
        }),
      );
    } else if (dto.status === DeliveryStatus.DELIVERED) {
      updates.deliveredAt = new Date();
      if (delivery.courierId) {
        // These are DB updates, should be part of a transaction if updateDeliveryStatus were transactional
        // For now, these are outside of the main delivery update transaction scope.
        await this.courierRepo.updateAvailability(delivery.courierId, true);
        await this.courierRepo.incrementDeliveries(delivery.courierId);
      }
      const items =
        delivery.vendorOrders?.flatMap(
          (vo: any) =>
            vo.items?.map((item: any) => ({
              vendorProductId: item.vendorProductId,
              quantity: item.quantity,
              actualWeightGrams: item.actualWeightGrams,
              vendorUserId: vo.vendorUserId, // Added
            })) || [],
        ) || [];

      eventsToPublish.push(() =>
        this.publisher.publishOrderDelivered({
          deliveryId,
          customerOrderId: delivery.customerOrderId,
          customerId: delivery.customerId,
          items,
          vendorOrdersIds,
        }),
      );
    }

    await this.deliveryRepo.update(deliveryId, updates); // DB update happens here

    // Publish events AFTER DB update
    for (const publishFn of eventsToPublish) {
      await publishFn();
    }
  }

  async acceptDelivery(deliveryId: string, userId: string): Promise<void> {
    if (!this.officeRepo) throw new ValidationError("office_repository_not_configured");

    const office = await this.officeRepo.findByUserId(userId);
    if (!office) throw new NotFoundError("delivery_office_not_found");

    const accepted = await this.deliveryRepo.acceptDelivery(deliveryId, office.id);
    if (!accepted) throw new ValidationError("delivery_already_accepted_by_another_office");

    this.publisher.publishDeliveryAccepted({ deliveryId, officeId: office.id }).catch(() => {});
  }

  async assignCourier(deliveryId: string, dto: AssignCourierDto, managerId?: string): Promise<void> {
    let connection: PoolConnection | undefined;
    const eventsToPublish: (() => Promise<void>)[] = [];

    try {
      connection = await this.db.beginTransaction();

      const delivery = await this.deliveryRepo.findById(deliveryId, connection);
      if (!delivery) throw new NotFoundError("delivery_not_found");

      if (delivery.status !== DeliveryStatus.ACCEPTED) {
        throw new ValidationError("delivery_must_be_accepted_before_assignment");
      }

      if (managerId && this.officeRepo) {
        const office = await this.officeRepo.findByUserId(managerId);
        if (!office) throw new NotFoundError("delivery_office_not_found");
        if (delivery.deliveryOfficeId !== office.id) {
          throw new ValidationError("delivery_not_assigned_to_your_office");
        }
      }

      const courier = await this.courierRepo.findById(dto.courierId, connection);
      if (!courier) throw new NotFoundError("courier_not_found");

      await this.deliveryRepo.assignCourier(deliveryId, dto.courierId, this.assignedWindowMinutes, connection);
      await this.courierRepo.updateAvailability(dto.courierId, false, connection);

      eventsToPublish.push(() =>
        this.publisher.publishCourierAssigned({
          deliveryId: delivery.id,
          courierId: dto.courierId,
          courierUserId: courier.userId,
          customerId: delivery.customerId,
          customerOrderId: delivery.customerOrderId,
        }),
      );

      await this.db.commit(connection);

      // Publish events after successful commit
      for (const publishFn of eventsToPublish) {
        await publishFn();
      }
    } catch (error) {
      if (connection) {
        await this.db.rollback(connection);
      }
      throw error;
    }
  }

  private isValidStatusTransition(currentStatus: DeliveryStatus, newStatus: DeliveryStatus): boolean {
    const transitions: Record<string, DeliveryStatus[]> = {
      [DeliveryStatus.PENDING]: [DeliveryStatus.ACCEPTED, DeliveryStatus.FAILED],
      [DeliveryStatus.ACCEPTED]: [DeliveryStatus.ASSIGNED, DeliveryStatus.FAILED],
      [DeliveryStatus.ASSIGNED]: [DeliveryStatus.PICKED_UP, DeliveryStatus.FAILED],
      [DeliveryStatus.PICKED_UP]: [DeliveryStatus.ON_THE_WAY, DeliveryStatus.FAILED],
      [DeliveryStatus.ON_THE_WAY]: [DeliveryStatus.DELIVERED, DeliveryStatus.FAILED],
      [DeliveryStatus.DELIVERED]: [],
      [DeliveryStatus.FAILED]: [DeliveryStatus.FAILED],
    };

    return transitions[currentStatus]?.includes(newStatus) || false;
  }

  async cancelDeliveryByCourier(deliveryId: string, courierId: string, reason: string): Promise<void> {
    const delivery = await this.deliveryRepo.findById(deliveryId);
    if (!delivery) throw new NotFoundError("delivery_not_found");
    if (delivery.courierId !== courierId) throw new ValidationError("not_your_delivery");
    if (delivery.status !== DeliveryStatus.ASSIGNED) throw new ValidationError("invalid_delivery_status_for_cancellation");

    await this.deliveryRepo.update(deliveryId, { status: DeliveryStatus.FAILED });
    await this.courierRepo.updateAvailability(courierId, true);

    await this.publisher.publishDeliveryFailedByCourier({
      deliveryId,
      customerOrderId: delivery.customerOrderId,
      customerId: delivery.customerId,
      reason,
    });
  }

  async cancelExpiredAssignedDeliveries(): Promise<void> {
    const expired = await this.deliveryRepo.findExpiredAssigned();
    for (const delivery of expired) {
      let connection: PoolConnection | undefined;
      try {
        connection = await this.db.beginTransaction();
        const locked = await this.deliveryRepo.findById(delivery.id, connection);
        if (!locked || locked.status !== DeliveryStatus.ASSIGNED) {
          await this.db.rollback(connection);
          connection = undefined;
          continue;
        }

        await this.deliveryRepo.update(delivery.id, { status: DeliveryStatus.FAILED }, connection);

        if (delivery.courierId) {
          await this.courierRepo.updateAvailability(delivery.courierId, true, connection);
        }

        await this.db.commit(connection);
        connection = undefined;

        await this.publisher.publishDeliveryFailed({
          deliveryId: delivery.id,
          customerOrderId: delivery.customerOrderId,
          customerId: delivery.customerId,
        });
      } catch (err: any) {
        if (connection) await this.db.rollback(connection);
        Logger.warn(`[DeliveryService] Failed to cancel expired delivery ${delivery.id}: ${err.message}`);
      }
    }
  }

  async getVendorDeliveriesCount(vendorOrderIds: string[], periodStart?: Date, periodEnd?: Date): Promise<number> {
    return this.deliveryRepo.countByVendorOrderIds(vendorOrderIds, periodStart, periodEnd);
  }
}

import { randomUUID } from "crypto";
import { PoolConnection } from "mysql2/promise";
import { ICourierRepository, CourierListFilter } from "../../core/interfaces/courier.repository";
import { DeliveryFeeSplit, IDeliveryRepository } from "../../core/interfaces/delivery.repository";
import { IDeliveryOfficeRepository } from "../../core/interfaces/delivery-office.repository";
import { IDeliveryFeeTierRepository } from "../../core/interfaces/delivery-fee-tier.repository";
import { Courier, CourierApprovalStatus } from "../../core/entities/courier.entity";
import { Delivery, FulfillmentType } from "../../core/entities/delivery.entity";
import { DeliveryOffice } from "../../core/entities/delivery-office.entity";
import { RegisterCourierDto, RegisterFreelancerDto, UpdateCourierDto, UpdateCourierLocationDto } from "../../core/dto/courier.dto";
import { CreateDeliveryDto, AssignCourierDto, UpdateDeliveryStatusDto } from "../../core/dto/delivery.dto";
import { DeliveryStatus, PickupLocation, UserRole, VendorOrderStatus } from "@city-market/shared";
import { ValidationError, NotFoundError, ForbiddenError } from "@city-market/shared";
import { Logger, Database } from "@city-market/shared/node";
import { OrderHttpClient } from "../../infrastructure/http/order-http-client";
import { VendorHttpClient } from "../../infrastructure/http/vendor-http-client";
import { UserHttpClient } from "../../infrastructure/http/user-http-client";
import { AuthHttpClient } from "../../infrastructure/http/auth-http-client";
import { DeliveryPublisher } from "../../infrastructure/messaging/DeliveryPublisher";
import type { DeliverySlaManager } from "./delivery-sla.manager";
import { FreelanceDispatcher } from "./freelance-dispatcher";
import {
  DeliveryRatingFilter,
  DeliveryRatingSummary,
  DeliveryRatingView,
  IDeliveryRatingRepository,
} from "../../core/interfaces/delivery-rating.repository";
import { mapWithConcurrency } from "../../utils/concurrency";
import { haversineKm } from "../../utils/geo";

const DISTANCE_THRESHOLD_KM = 2.0;
const ENRICHMENT_CONCURRENCY = 5;

// Who is calling. Service-to-service calls (no user token) act as ADMIN.
export interface Actor {
  userId?: string;
  role: UserRole;
}

const round2 = (n: number) => Number(n.toFixed(2));

// While a courier holds the order the customer can see and call them
const COURIER_VISIBLE_STATUSES = [DeliveryStatus.ASSIGNED, DeliveryStatus.PICKED_UP, DeliveryStatus.ON_THE_WAY];

export interface CustomerOrderCourier {
  deliveryId: string;
  status: DeliveryStatus;
  fulfillmentType: FulfillmentType | null;
  pickupCount: number;
  // Phone only while the courier holds the order; after delivery just who it was
  courier: { name: string; phone: string; vehicleType: string | null; licensePlate: string | null } | null;
  officeName: string | null;
  myRating: { stars: number; comment: string | null } | null;
  canRate: boolean;
}

const MAX_RATING_COMMENT = 500;

// Signup documents must be media-service uploads to the courier-documents folder
// Office signup documents: media-service uploads to the office-documents folder
const isOfficeDocumentUrl = (url?: string | null): url is string =>
  typeof url === "string" && /^https?:\/\/[^\s]+\/office-documents\/[^\s]+$/.test(url) && url.length <= 512;

const isCourierDocumentUrl = (url?: string | null): url is string =>
  typeof url === "string" && /^https?:\/\/[^\s]+\/courier-documents\/[^\s]+$/.test(url) && url.length <= 512;

export class DeliveryService {
  private slaManager?: DeliverySlaManager;

  constructor(
    private courierRepo: ICourierRepository,
    private deliveryRepo: IDeliveryRepository,
    private publisher: DeliveryPublisher,
    private orderClient: OrderHttpClient,
    private vendorClient: VendorHttpClient,
    private userClient: UserHttpClient,
    private authClient: AuthHttpClient,
    private db: Database,
    private feeTierRepo: IDeliveryFeeTierRepository,
    private officeRepo: IDeliveryOfficeRepository,
    private dispatcher: FreelanceDispatcher,
    private ratingRepo: IDeliveryRatingRepository,
  ) {}

  setSlaManager(slaManager: DeliverySlaManager): void {
    this.slaManager = slaManager;
  }

  // ── Actor helpers ────────────────────────────────────────────────────────────

  // A manager without an office record gets an error, never a fallback to "everything" (S4).
  // Only approved offices may work; a self-registered office waits for admin review.
  private async requireOffice(userId?: string): Promise<DeliveryOffice> {
    const office = userId ? await this.officeRepo.findByUserId(userId) : null;
    if (!office) throw new NotFoundError("delivery_office_not_found");
    if (office.approvalStatus !== "APPROVED") throw new ForbiddenError("office_not_approved");
    return office;
  }

  private async requireCourier(userId?: string): Promise<Courier> {
    const courier = userId ? await this.courierRepo.findByUserId(userId) : null;
    if (!courier) throw new NotFoundError("courier_not_found_by_user");
    return courier;
  }

  private assertApprovedFreelancer(courier: Courier): void {
    if (courier.courierType !== "FREELANCE") throw new ForbiddenError("freelance_couriers_only");
    if (courier.approvalStatus !== "APPROVED") throw new ForbiddenError("courier_not_approved");
    if (!courier.isActive) throw new ForbiddenError("courier_inactive");
  }

  private assertFreelanceEnabled(): void {
    if (!this.dispatcher.config.freelanceEnabled) throw new ValidationError("freelance_disabled");
  }

  // COURIER: only themselves. MANAGER: only couriers of their office. ADMIN: anyone (S2).
  private async assertCanManageCourier(courier: Courier, actor: Actor): Promise<void> {
    if (actor.role === UserRole.ADMIN) return;
    if (actor.role === UserRole.COURIER) {
      if (courier.userId !== actor.userId) throw new ForbiddenError("not_your_courier_profile");
      return;
    }
    if (actor.role === UserRole.DELIVERY_MANAGER) {
      const office = await this.requireOffice(actor.userId);
      if (courier.deliveryOfficeId !== office.id) throw new ForbiddenError("courier_not_in_your_office");
      return;
    }
    throw new ForbiddenError();
  }

  private isUnclaimed(delivery: Delivery): boolean {
    return delivery.status === DeliveryStatus.PENDING && !delivery.deliveryOfficeId && !delivery.courierId;
  }

  // read: may see the delivery at all. full: may also see customer phone and act on it (S1/S3).
  private async resolveDeliveryAccess(delivery: Delivery, actor: Actor): Promise<"full" | "read" | "none"> {
    if (actor.role === UserRole.ADMIN) return "full";
    if (actor.role === UserRole.DELIVERY_MANAGER) {
      const office = await this.requireOffice(actor.userId);
      if (delivery.deliveryOfficeId === office.id) return "full";
      return this.isUnclaimed(delivery) ? "read" : "none";
    }
    if (actor.role === UserRole.COURIER) {
      const courier = await this.requireCourier(actor.userId);
      if (delivery.courierId === courier.id) return "full";
      const canSeePool =
        courier.courierType === "FREELANCE" && courier.approvalStatus === "APPROVED" && this.dispatcher.config.freelanceEnabled && this.isUnclaimed(delivery);
      return canSeePool ? "read" : "none";
    }
    return "none";
  }

  // ── Courier management ───────────────────────────────────────────────────────

  async registerCourier(dto: RegisterCourierDto, actor: Actor): Promise<Courier> {
    if (!dto.userId) throw new ValidationError("user_id_required");
    const existing = await this.courierRepo.findByUserId(dto.userId);
    if (existing) {
      throw new ValidationError("courier_already_registered");
    }

    // S7: the profile must belong to a COURIER user
    const role = await this.authClient.getUserRole(dto.userId);
    if (!role) throw new NotFoundError("user_not_found");
    if (role !== UserRole.COURIER) throw new ValidationError("user_is_not_a_courier");

    let courierType: Courier["courierType"] = "OFFICE";
    let deliveryOfficeId: string | null = null;

    if (actor.role === UserRole.DELIVERY_MANAGER) {
      // F1: managers always create couriers in their own office
      deliveryOfficeId = (await this.requireOffice(actor.userId)).id;
    } else {
      courierType = dto.courierType ?? "OFFICE";
      if (courierType === "OFFICE") {
        if (!dto.deliveryOfficeId) throw new ValidationError("delivery_office_required_for_office_courier");
        const office = await this.officeRepo.findById(dto.deliveryOfficeId);
        if (!office) throw new NotFoundError("delivery_office_not_found");
        deliveryOfficeId = office.id;
      } else if (dto.deliveryOfficeId) {
        throw new ValidationError("freelance_courier_cannot_have_office");
      }
    }

    const courier: Courier = {
      id: randomUUID(),
      userId: dto.userId,
      deliveryOfficeId,
      courierType,
      // Admin-created couriers are vetted by the admin; a manager's request waits for review
      approvalStatus: actor.role === UserRole.DELIVERY_MANAGER ? "PENDING_REVIEW" : "APPROVED",
      cancellationCount: 0,
      ratingCount: 0,
      fullName: dto.fullName,
      phone: dto.phone,
      vehicleType: dto.vehicleType,
      licensePlate: dto.licensePlate,
      isAvailable: courierType === "OFFICE" && actor.role !== UserRole.DELIVERY_MANAGER,
      isActive: true,
      rating: 5.0,
      totalDeliveries: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.courierRepo.create(courier);
  }

  // An office manager adds a new courier to their office: creates the courier's login
  // and profile in one go. It waits for admin review (PENDING_REVIEW) before they can work.
  async createOfficeCourier(
    managerUserId: string,
    dto: {
      email?: string;
      password?: string;
      fullName?: string;
      phone?: string;
      vehicleType?: string;
      licensePlate?: string;
      nationalIdUrl?: string;
      licenseUrl?: string;
    },
  ): Promise<Courier> {
    const office = await this.requireOffice(managerUserId);
    const fullName = dto.fullName?.trim();
    const phone = dto.phone?.trim();
    if (!fullName || !phone) throw new ValidationError("full_name_and_phone_required");
    if (!dto.email?.trim() || !dto.password || dto.password.length < 8) throw new ValidationError("courier_email_and_password_required");
    if (!isCourierDocumentUrl(dto.nationalIdUrl)) throw new ValidationError("national_id_document_required");
    const needsLicense = (dto.vehicleType ?? "Motorcycle") !== "Bicycle";
    if (needsLicense && !isCourierDocumentUrl(dto.licenseUrl)) throw new ValidationError("driving_license_document_required");
    if (dto.licenseUrl && !isCourierDocumentUrl(dto.licenseUrl)) throw new ValidationError("invalid_document_url");

    // Everything is checked before the account exists, so a bad form leaves nothing behind
    const userId = await this.authClient.registerCourierUser(dto.email.trim().toLowerCase(), dto.password, fullName);

    const courier: Courier = {
      id: randomUUID(),
      userId,
      deliveryOfficeId: office.id,
      courierType: "OFFICE",
      approvalStatus: "PENDING_REVIEW",
      nationalIdUrl: dto.nationalIdUrl,
      licenseUrl: needsLicense ? dto.licenseUrl : null,
      cancellationCount: 0,
      ratingCount: 0,
      fullName,
      phone,
      vehicleType: dto.vehicleType,
      licensePlate: dto.licensePlate?.trim() || undefined,
      isAvailable: false,
      isActive: true,
      rating: 5.0,
      totalDeliveries: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const created = await this.courierRepo.create(courier);
    await this.publisher
      .publishCourierReviewRequested({ courierId: created.id, courierName: fullName, deliveryOfficeId: office.id, officeName: office.name })
      .catch((err) => Logger.warn(`Failed to publish COURIER_REVIEW_REQUESTED for ${created.id}: ${err.message}`));
    return created;
  }

  // A COURIER user signs themselves up as a freelancer; an admin must approve them.
  async registerFreelancer(userId: string, dto: RegisterFreelancerDto): Promise<Courier> {
    const existing = await this.courierRepo.findByUserId(userId);
    if (existing) throw new ValidationError("courier_already_registered");
    if (!dto.fullName?.trim() || !dto.phone?.trim()) throw new ValidationError("full_name_and_phone_required");
    if (!isCourierDocumentUrl(dto.nationalIdUrl)) throw new ValidationError("national_id_document_required");
    // Bicycles need no license; anything motorised does
    const needsLicense = (dto.vehicleType ?? "Motorcycle") !== "Bicycle";
    if (needsLicense && !isCourierDocumentUrl(dto.licenseUrl)) throw new ValidationError("driving_license_document_required");
    if (dto.licenseUrl && !isCourierDocumentUrl(dto.licenseUrl)) throw new ValidationError("invalid_document_url");

    const courier: Courier = {
      id: randomUUID(),
      userId,
      deliveryOfficeId: null,
      courierType: "FREELANCE",
      approvalStatus: "PENDING_REVIEW",
      ratingCount: 0,
      nationalIdUrl: dto.nationalIdUrl,
      licenseUrl: dto.licenseUrl ?? null,
      cancellationCount: 0,
      fullName: dto.fullName.trim(),
      phone: dto.phone.trim(),
      vehicleType: dto.vehicleType,
      licensePlate: dto.licensePlate,
      isAvailable: false,
      isActive: true,
      rating: 5.0,
      totalDeliveries: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return this.courierRepo.create(courier);
  }

  // ── Delivery offices: self-registration and admin review ──────────────────────

  // A DELIVERY_MANAGER user registers their office; it waits for admin approval.
  async registerOffice(
    userId: string,
    dto: { name?: string; phone?: string; address?: string; ownerNationalIdUrl?: string; commercialRegisterUrl?: string },
  ): Promise<DeliveryOffice> {
    if (await this.officeRepo.findByUserId(userId)) throw new ValidationError("office_already_registered");
    const name = dto.name?.trim();
    const phone = dto.phone?.trim();
    const address = dto.address?.trim();
    if (!name || !phone || !address) throw new ValidationError("office_name_phone_address_required");
    if (!isOfficeDocumentUrl(dto.ownerNationalIdUrl)) throw new ValidationError("national_id_document_required");
    if (!isOfficeDocumentUrl(dto.commercialRegisterUrl)) throw new ValidationError("commercial_register_document_required");

    const office: DeliveryOffice = {
      id: randomUUID(),
      userId,
      name,
      phone,
      address,
      isActive: true,
      approvalStatus: "PENDING_REVIEW",
      ownerNationalIdUrl: dto.ownerNationalIdUrl,
      commercialRegisterUrl: dto.commercialRegisterUrl,
      rating: null,
      ratingCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return this.officeRepo.create(office);
  }

  // Admin adds an office for an existing DELIVERY_MANAGER user. The admin vetted it,
  // so it starts APPROVED; documents are optional here.
  async createOfficeByAdmin(dto: {
    userId?: string;
    name?: string;
    phone?: string;
    address?: string;
    ownerNationalIdUrl?: string;
    commercialRegisterUrl?: string;
  }): Promise<DeliveryOffice> {
    if (!dto.userId) throw new ValidationError("user_id_required");
    const name = dto.name?.trim();
    const phone = dto.phone?.trim();
    const address = dto.address?.trim();
    if (!name || !phone || !address) throw new ValidationError("office_name_phone_address_required");
    if (await this.officeRepo.findByUserId(dto.userId)) throw new ValidationError("office_already_registered");

    const role = await this.authClient.getUserRole(dto.userId);
    if (!role) throw new NotFoundError("user_not_found");
    if (role !== UserRole.DELIVERY_MANAGER) throw new ValidationError("user_is_not_a_delivery_manager");
    for (const url of [dto.ownerNationalIdUrl, dto.commercialRegisterUrl]) {
      if (url && !isOfficeDocumentUrl(url)) throw new ValidationError("invalid_document_url");
    }

    return this.officeRepo.create({
      id: randomUUID(),
      userId: dto.userId,
      name,
      phone,
      address,
      isActive: true,
      approvalStatus: "APPROVED",
      ownerNationalIdUrl: dto.ownerNationalIdUrl ?? null,
      commercialRegisterUrl: dto.commercialRegisterUrl ?? null,
      rating: null,
      ratingCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async setOfficeApproval(officeId: string, status: "APPROVED" | "SUSPENDED"): Promise<void> {
    if (!["APPROVED", "SUSPENDED"].includes(status)) throw new ValidationError("invalid_approval_status");
    const office = await this.officeRepo.findById(officeId);
    if (!office) throw new NotFoundError("delivery_office_not_found");
    if (office.approvalStatus === status) return;
    // Deliveries the office already holds continue; a suspended office just can't take new work.
    await this.officeRepo.setApprovalStatus(officeId, status);
    await this.publisher
      .publishOfficeApprovalUpdated({ officeId, officeUserId: office.userId, approvalStatus: status })
      .catch((err) => Logger.warn(`Failed to publish OFFICE_APPROVAL_UPDATED for ${officeId}: ${err.message}`));
  }

  // Everything an admin needs to review an office: profile, documents, couriers, delivery record
  async getOfficeDetails(officeId: string) {
    const office = await this.officeRepo.findById(officeId);
    if (!office) throw new NotFoundError("delivery_office_not_found");
    const [couriers, byStatus] = await Promise.all([
      this.courierRepo.findByOfficeId(office.id, 1000, 0),
      this.deliveryRepo.countByStatusForOffice(office.id),
    ]);
    const active = [DeliveryStatus.ACCEPTED, DeliveryStatus.ASSIGNED, DeliveryStatus.PICKED_UP, DeliveryStatus.ON_THE_WAY].reduce(
      (n, s) => n + (byStatus[s] ?? 0),
      0,
    );
    return {
      office,
      stats: {
        couriers: couriers.length,
        activeCouriers: couriers.filter((c) => c.isActive).length,
        activeDeliveries: active,
        delivered: byStatus[DeliveryStatus.DELIVERED] ?? 0,
        failed: byStatus[DeliveryStatus.FAILED] ?? 0,
      },
    };
  }

  async listOffices(limit: number, offset: number, approvalStatus?: "PENDING_REVIEW" | "APPROVED" | "SUSPENDED") {
    return this.officeRepo.findAllByApproval(limit, offset, approvalStatus);
  }

  async getAllCouriers(page: number = 1, limit: number = 20, actor: Actor, filter: CourierListFilter = {}): Promise<Courier[]> {
    const offset = (page - 1) * limit;
    if (actor.role === UserRole.DELIVERY_MANAGER) {
      const office = await this.requireOffice(actor.userId);
      return this.courierRepo.findByOfficeId(office.id, limit, offset);
    }
    return this.courierRepo.findAll(limit, offset, filter);
  }

  async countCouriers(filter: CourierListFilter = {}): Promise<number> {
    return this.courierRepo.countAll(filter);
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

  async getAvailableCouriers(actor: Actor): Promise<Courier[]> {
    if (actor.role === UserRole.DELIVERY_MANAGER) {
      const office = await this.requireOffice(actor.userId);
      return this.courierRepo.findAvailableByOfficeId(office.id);
    }
    if (actor.role !== UserRole.ADMIN) throw new ForbiddenError();
    return this.courierRepo.findAvailable();
  }

  // Everything an admin (or the courier's office manager) needs to review a courier:
  // profile incl. identity documents, office, and delivery counts.
  async getCourierDetails(courierId: string, actor: Actor) {
    const courier = await this.getCourierById(courierId);
    if (actor.role === UserRole.DELIVERY_MANAGER) await this.assertCanManageCourier(courier, actor);
    else if (actor.role !== UserRole.ADMIN) throw new ForbiddenError();

    const [office, byStatus, cashHeld] = await Promise.all([
      courier.deliveryOfficeId ? this.officeRepo.findById(courier.deliveryOfficeId) : Promise.resolve(null),
      this.deliveryRepo.countByStatusForCourier(courier.id),
      this.deliveryRepo.sumUnsettledCashForCourier(courier.id),
    ]);
    const active = [DeliveryStatus.ASSIGNED, DeliveryStatus.PICKED_UP, DeliveryStatus.ON_THE_WAY].reduce((n, s) => n + (byStatus[s] ?? 0), 0);
    return {
      courier,
      office: office ? { id: office.id, name: office.name, phone: office.phone ?? null } : null,
      stats: {
        active,
        delivered: byStatus[DeliveryStatus.DELIVERED] ?? 0,
        failed: byStatus[DeliveryStatus.FAILED] ?? 0,
        cancellations: courier.cancellationCount,
        unsettledCash: cashHeld,
      },
    };
  }

  async getCourierDetailsByUserId(userId: string, actor: Actor) {
    return this.getCourierDetails((await this.getCourierByUserId(userId)).id, actor);
  }

  async updateCourier(id: string, dto: UpdateCourierDto, actor: Actor): Promise<void> {
    const courier = await this.getCourierById(id);
    await this.assertCanManageCourier(courier, actor);
    // Whitelist: never let a request body change type, office or approval
    const { fullName, phone, vehicleType, licensePlate } = dto;
    await this.courierRepo.update(id, { fullName, phone, vehicleType, licensePlate });
  }

  async updateCourierAvailability(id: string, isAvailable: boolean, actor: Actor): Promise<void> {
    const courier = await this.getCourierById(id);
    await this.assertCanManageCourier(courier, actor);
    if (typeof isAvailable !== "boolean") throw new ValidationError("is_available_must_be_boolean");

    if (isAvailable) {
      if (!courier.isActive) throw new ValidationError("courier_inactive");
      // Freelancers and manager-added office couriers both need admin approval first
      if (courier.approvalStatus !== "APPROVED") throw new ValidationError("courier_not_approved");
      // is_available doubles as "idle"; going online mid-delivery would allow a second assignment
      if ((await this.deliveryRepo.countActiveForCourier(id)) > 0) throw new ValidationError("courier_has_active_delivery");
    }
    await this.courierRepo.updateAvailability(id, isAvailable);
  }

  async updateMyLocation(userId: string, dto: UpdateCourierLocationDto): Promise<void> {
    const courier = await this.requireCourier(userId);
    const { latitude, longitude } = dto;
    if (typeof latitude !== "number" || typeof longitude !== "number" || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      throw new ValidationError("invalid_coordinates");
    }
    await this.courierRepo.updateLocation(courier.id, latitude, longitude);
  }

  // F6. Couriers are deactivated, never deleted (settlement history).
  async deactivateCourier(id: string, actor: Actor): Promise<void> {
    const courier = await this.getCourierById(id);
    if (actor.role === UserRole.COURIER) throw new ForbiddenError();
    await this.assertCanManageCourier(courier, actor);
    if ((await this.deliveryRepo.countActiveForCourier(id)) > 0) throw new ValidationError("courier_has_active_delivery");
    await this.courierRepo.deactivate(id);
  }

  // Admin decision on a freelancer or a manager-added office courier.
  // REJECTED: a pending request turned down; SUSPENDED: a working courier stopped.
  async setCourierApproval(id: string, status: CourierApprovalStatus): Promise<void> {
    if (!["APPROVED", "SUSPENDED", "REJECTED"].includes(status)) throw new ValidationError("invalid_approval_status");
    const courier = await this.getCourierById(id);
    if (courier.approvalStatus === status) return;
    // A suspended courier keeps any delivery already in hand; they just can't take new ones.
    await this.courierRepo.setApprovalStatus(id, status);
    // The office manager who asked for this courier hears about it too
    const office = courier.deliveryOfficeId ? await this.officeRepo.findById(courier.deliveryOfficeId) : null;
    await this.publisher
      .publishCourierApprovalUpdated({
        courierId: courier.id,
        courierUserId: courier.userId,
        courierName: courier.fullName,
        approvalStatus: status,
        officeUserId: office?.userId,
      })
      .catch((err) => Logger.warn(`Failed to publish COURIER_APPROVAL_UPDATED for ${courier.id}: ${err.message}`));
  }

  // ── Fees ─────────────────────────────────────────────────────────────────────

  // M3: the split depends on who delivers, so it's computed on accept/claim, not at creation.
  // Rounding leftovers go to the platform so the three parts always sum to the fee.
  private async computeFeeSplit(delivery: Delivery, fulfillment: FulfillmentType): Promise<DeliveryFeeSplit> {
    const fee = delivery.deliveryFee || 0;
    if (fee <= 0) return { courierPercentage: null, courierFeeAmount: 0, officeFeeAmount: 0, platformFeeAmount: 0 };

    // The tier may have been edited or deleted since creation; fall back to the current tier for this fee
    const tier = (delivery.feeTierId && (await this.feeTierRepo.findById(delivery.feeTierId))) || (await this.feeTierRepo.findByAmount(fee));
    if (!tier) {
      Logger.warn(`No delivery fee tier matches fee ${fee} for delivery ${delivery.id}; platform keeps the whole fee`);
      return { courierPercentage: null, courierFeeAmount: 0, officeFeeAmount: 0, platformFeeAmount: round2(fee) };
    }

    if (fulfillment === "OFFICE") {
      const courierFeeAmount = round2((fee * tier.courierPercentage) / 100);
      const officeFeeAmount = round2((fee * tier.officePercentage) / 100);
      return { courierPercentage: tier.courierPercentage, courierFeeAmount, officeFeeAmount, platformFeeAmount: round2(fee - courierFeeAmount - officeFeeAmount) };
    }

    // Q2 default: without explicit freelance percentages, the office share goes to the courier
    const courierPercentage = tier.freelanceCourierPercentage ?? tier.courierPercentage + tier.officePercentage;
    const courierFeeAmount = round2((fee * courierPercentage) / 100);
    return { courierPercentage, courierFeeAmount, officeFeeAmount: 0, platformFeeAmount: round2(fee - courierFeeAmount) };
  }

  // ── Delivery creation ────────────────────────────────────────────────────────

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
      feeTierId: dto.feeTierId ?? null,
      courierFeeAmount: 0,
      officeFeeAmount: 0,
      platformFeeAmount: 0,
      cashCollectedAmount: 0,
      openToFreelanceAt: dto.openToFreelanceAt ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return this.deliveryRepo.create(delivery, connection);
  }

  // Office-priority window for a new delivery, in minutes. 0 when freelancing is off
  // (the timestamp is then irrelevant) or when no office could take it anyway.
  private async officePriorityWindow(): Promise<number> {
    const { freelanceEnabled, officePriorityWindowMins } = this.dispatcher.config;
    if (!freelanceEnabled || officePriorityWindowMins <= 0) return 0;
    return (await this.officeRepo.countActive()) > 0 ? officePriorityWindowMins : 0;
  }

  async createDeliveryFromOrder(customerOrderId: string, userId?: string, deliveryFee?: number): Promise<Delivery[]> {
    let connection: PoolConnection | undefined;
    const eventsToPublish: (() => Promise<void>)[] = [];
    const createdDeliveries: Delivery[] = [];

    const windowMins = await this.officePriorityWindow();
    const openToFreelanceAt = new Date(Date.now() + windowMins * 60_000);

    // Everything a new delivery needs after commit: event, acceptance SLA, freelance window.
    const afterCreate = (delivery: Delivery, customerId: string) => {
      eventsToPublish.push(() => this.publisher.publishDeliveryCreated({ deliveryId: delivery.id, customerId, customerOrderId }));
      eventsToPublish.push(async () => {
        if (!this.slaManager) return;
        const params = { deliveryId: delivery.id, customerOrderId, customerId };
        await this.slaManager.scheduleAcceptanceSla(params, windowMins);
        if (!this.dispatcher.config.freelanceEnabled) return;
        if (windowMins > 0) await this.slaManager.scheduleFreelanceOpen(params, openToFreelanceAt);
        else await this.dispatcher.notifyDeliveryOpen(delivery);
      });
    };

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
      const vendorOrders = (orderData.vendorOrders || []).filter((vo: any) => vo.status !== VendorOrderStatus.CANCELLED);

      if (vendorOrders.length === 0) {
        Logger.warn(`No non-cancelled vendor orders for Customer Order ${customerOrderId}. Skipping delivery creation.`);
        await this.db.commit(connection);
        return createdDeliveries;
      }

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
        const existingDeliveries = await this.deliveryRepo.findByCustomerOrderId(customerOrderId, connection);
        if (existingDeliveries.length > 0) {
          Logger.info(`Grouped delivery already exists for Customer Order ${customerOrderId}. Skipping creation.`);
          await this.db.commit(connection);
          return existingDeliveries; // Return existing deliveries to maintain idempotency
        }

        const delivery = await this.createIndividualDelivery(customerOrder, vendors, customerOrderId, undefined, connection, deliveryFee, openToFreelanceAt);
        createdDeliveries.push(delivery);
        afterCreate(delivery, customerOrder.customerId);
      } else {
        // Separate Delivery per VendorOrder
        for (const v of vendors) {
          const existingDelivery = await this.deliveryRepo.findByCustomerOrderAndVendorOrder(customerOrderId, v.id, connection);
          if (existingDelivery) {
            Logger.info(`Delivery already exists for Customer Order ${customerOrderId} and Vendor Order ${v.id}. Skipping creation.`);
            createdDeliveries.push(existingDelivery);
            continue;
          }

          const delivery = await this.createIndividualDelivery(customerOrder, [v], customerOrderId, v, connection, deliveryFee, openToFreelanceAt);
          createdDeliveries.push(delivery);
          afterCreate(delivery, customerOrder.customerId);
        }
      }

      await this.db.commit(connection);
    } catch (error: any) {
      if (connection) {
        await this.db.rollback(connection);
      }
      eventsToPublish.length = 0;

      // Check if the error is a MySQL unique constraint violation
      if (error.code === "ER_DUP_ENTRY") {
        Logger.warn(`Duplicate delivery insertion attempt for Order ${customerOrderId} blocked. Resuming gracefully.`);
        return this.deliveryRepo.findByCustomerOrderId(customerOrderId);
      }

      throw error;
    }

    // Publish all collected events after the transaction committed
    for (const publishFn of eventsToPublish) {
      await publishFn().catch((err) => Logger.error(`Post-create step failed for order ${customerOrderId}`, err));
    }
    return createdDeliveries;
  }

  private async createIndividualDelivery(
    customerOrder: any,
    vendors: any[],
    customerOrderId: string,
    vendorOrder: any | undefined,
    connection: PoolConnection | undefined,
    deliveryFee: number | undefined,
    openToFreelanceAt: Date,
  ): Promise<Delivery> {
    const itemsCount = vendors.reduce((sum, v) => sum + (v.items?.length || 0), 0);
    const totalPrice = vendors.reduce((sum, v) => sum + (v.totalAmount || 0), 0);

    // Snapshot the tier only; the split is computed on accept/claim (M3)
    const tier = deliveryFee && deliveryFee > 0 ? await this.feeTierRepo.findByAmount(deliveryFee) : null;

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
      feeTierId: tier?.id ?? null,
      openToFreelanceAt,
    };

    return this.createDelivery(dto, connection);
  }

  private checkDistances(vendors: any[]): boolean {
    if (vendors.length <= 1) return false;

    for (let i = 0; i < vendors.length; i++) {
      for (let j = i + 1; j < vendors.length; j++) {
        const dist = haversineKm(
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

  // ── Reads ────────────────────────────────────────────────────────────────────

  async getDeliveryById(id: string, actor: Actor): Promise<Delivery> {
    const delivery = await this.deliveryRepo.findById(id);
    if (!delivery) {
      throw new NotFoundError("delivery_not_found");
    }

    // S3: don't reveal that a delivery exists to someone with no claim on it
    const access = await this.resolveDeliveryAccess(delivery, actor);
    if (access === "none") throw new NotFoundError("delivery_not_found");

    const [enriched] = await this.enrichDeliveriesWithOrderData([delivery], actor.userId, () => access === "full");
    return enriched;
  }

  // Unclaimed deliveries offices can accept. No customer phone until accepted (S3).
  async getPendingDeliveries(page: number = 1, limit: number = 50, actor: Actor): Promise<Delivery[]> {
    if (actor.role === UserRole.DELIVERY_MANAGER) await this.requireOffice(actor.userId);
    const deliveries = await this.deliveryRepo.findPending(limit, (page - 1) * limit);
    return this.enrichDeliveriesWithOrderData(deliveries, actor.userId, () => false);
  }

  async getCourierDeliveries(courierId: string, page: number = 1, limit: number = 20, userId?: string) {
    const offset = (page - 1) * limit;
    const rows = await this.deliveryRepo.findByCourier(courierId, limit + 1, offset);
    const hasNextPage = rows.length > limit;
    const items = await this.enrichDeliveriesWithOrderData(rows.slice(0, limit), userId, () => true);
    return { items, hasNextPage };
  }

  async getAllDeliveries(page: number = 1, limit: number = 20, actor: Actor) {
    const offset = (page - 1) * limit;

    if (actor.role === UserRole.DELIVERY_MANAGER) {
      const office = await this.requireOffice(actor.userId);
      const rows = await this.deliveryRepo.findForManager(office.id, limit + 1, offset);
      const hasNextPage = rows.length > limit;
      const items = await this.enrichDeliveriesWithOrderData(rows.slice(0, limit), actor.userId, (d) => d.deliveryOfficeId === office.id);
      return { items, hasNextPage };
    }

    const rows = await this.deliveryRepo.findAll(limit + 1, offset);
    const hasNextPage = rows.length > limit;
    const items = await this.enrichDeliveriesWithOrderData(rows.slice(0, limit), actor.userId, () => true);
    return { items, hasNextPage };
  }

  // The pool an approved freelancer can claim from, nearest first, without customer phone.
  async getFreelancePool(userId: string, page: number = 1, limit: number = 20): Promise<Array<Delivery & { distanceKm: number | null }>> {
    this.assertFreelanceEnabled();
    const courier = await this.requireCourier(userId);
    this.assertApprovedFreelancer(courier);

    const { freelanceRadiusKm } = this.dispatcher.config;
    if (freelanceRadiusKm > 0 && (courier.lastLatitude == null || courier.lastLongitude == null)) {
      throw new ValidationError("courier_location_required");
    }

    // Radius filtering happens in memory, so read a wider window than one page
    const candidates = await this.deliveryRepo.findFreelancePool(200, 0);
    const nearby = candidates
      .filter((d) => this.dispatcher.isWithinRadius(courier, d))
      .map((d) => Object.assign(d, { distanceKm: this.dispatcher.distanceKm(courier, d) }))
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    const pageItems = nearby.slice((page - 1) * limit, page * limit);
    return (await this.enrichDeliveriesWithOrderData(pageItems, userId, () => false)) as Array<Delivery & { distanceKm: number | null }>;
  }

  private async enrichDeliveriesWithOrderData(deliveries: Delivery[], userId: string | undefined, includeCustomerPhone: (d: Delivery) => boolean): Promise<Delivery[]> {
    if (deliveries.length === 0) return deliveries;

    // Each delivery costs one order-service + one user-service call. Bound how many
    // run at once so a big list can't exhaust those services' DB pools.
    return mapWithConcurrency(deliveries, ENRICHMENT_CONCURRENCY, async (delivery) => {
      const withPhone = includeCustomerPhone(delivery);
      try {
        const [orderData, customerPhone] = await Promise.all([
          this.orderClient.getOrder(delivery.customerOrderId, userId),
          withPhone ? this.userClient.getCustomerPhone(delivery.customerId) : Promise.resolve(null),
        ]);
        if (orderData && orderData.vendorOrders) {
          const cancelledVendorOrderIds = new Set(
            orderData.vendorOrders.filter((vo: any) => vo.status === VendorOrderStatus.CANCELLED).map((vo: any) => vo.id),
          );
          delivery.pickupLocations = delivery.pickupLocations.filter((pl) => !cancelledVendorOrderIds.has(pl.vendorOrderId));
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
    });
  }

  // Phase 4: who is bringing the customer's order. One entry per delivery (an order
  // split across far-apart stores has several). The courier is shown only while they
  // hold the order: nobody before assignment, and no phone after it's delivered.
  async getOrderCouriersForCustomer(customerOrderId: string, customerUserId: string): Promise<CustomerOrderCourier[]> {
    const deliveries = await this.deliveryRepo.findByCustomerOrderId(customerOrderId);
    // No delivery yet (order not ready) is a normal state; someone else's order is a 404
    if (deliveries.some((d) => d.customerId !== customerUserId)) throw new NotFoundError("delivery_not_found");

    const visible = deliveries.filter((d) => d.status !== DeliveryStatus.FAILED);
    const officeIds = Array.from(new Set(visible.map((d) => d.deliveryOfficeId).filter((id): id is string => !!id)));
    const [offices, ratings] = await Promise.all([
      Promise.all(officeIds.map((id) => this.officeRepo.findById(id))),
      this.ratingRepo.findByDeliveryIds(visible.map((d) => d.id)),
    ]);
    const officeNames = new Map(offices.filter((o) => !!o).map((o) => [o!.id, o!.name]));
    const ratingByDelivery = new Map(ratings.map((r) => [r.deliveryId, r]));

    return visible.map((d) => {
      const delivered = d.status === DeliveryStatus.DELIVERED;
      const showCourier = !!d.courierId && (COURIER_VISIBLE_STATUSES.includes(d.status) || delivered);
      const rating = ratingByDelivery.get(d.id);
      return {
        deliveryId: d.id,
        status: d.status,
        fulfillmentType: d.fulfillmentType ?? null,
        pickupCount: d.pickupLocations.length,
        courier: showCourier
          ? {
              name: d.courierName ?? "",
              phone: delivered ? "" : (d.courierPhone ?? ""),
              vehicleType: d.courierVehicleType ?? null,
              licensePlate: d.courierLicensePlate ?? null,
            }
          : null,
        officeName: d.deliveryOfficeId ? (officeNames.get(d.deliveryOfficeId) ?? null) : null,
        myRating: rating ? { stars: rating.stars, comment: rating.comment } : null,
        canRate: delivered && !!d.courierId && !rating,
      };
    });
  }

  // The customer rates a delivered delivery once. The rating counts toward the courier,
  // and toward the office as well when an office handled it.
  async rateDelivery(deliveryId: string, customerUserId: string, dto: { stars: number; comment?: string }): Promise<void> {
    const stars = Number(dto.stars);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new ValidationError("invalid_stars_value");
    const comment = typeof dto.comment === "string" ? dto.comment.trim() : "";
    if (comment.length > MAX_RATING_COMMENT) throw new ValidationError("invalid_comment_format");

    await this.db.withTransaction(async (connection) => {
      const delivery = await this.deliveryRepo.findByIdForUpdate(deliveryId, connection);
      if (!delivery || delivery.customerId !== customerUserId) throw new NotFoundError("delivery_not_found");
      if (delivery.status !== DeliveryStatus.DELIVERED || !delivery.courierId) throw new ValidationError("delivery_not_delivered_yet");
      if (await this.ratingRepo.findByDeliveryId(deliveryId, connection)) throw new ValidationError("delivery_already_rated");

      const officeId = delivery.fulfillmentType === "FREELANCE" ? null : (delivery.deliveryOfficeId ?? null);
      await this.ratingRepo.create(
        {
          id: randomUUID(),
          deliveryId,
          customerOrderId: delivery.customerOrderId,
          customerId: customerUserId,
          courierId: delivery.courierId,
          deliveryOfficeId: officeId,
          stars,
          comment: comment || null,
          createdAt: new Date(),
        },
        connection,
      );
      await this.ratingRepo.refreshCourierRating(delivery.courierId, connection);
      if (officeId) await this.ratingRepo.refreshOfficeRating(officeId, connection);
    });
  }

  // Delivery ratings, scoped to the caller: a courier sees their own, a manager their
  // office's (optionally one of its couriers), an admin anything (optional filters).
  async getDeliveryRatings(
    actor: Actor,
    query: { courierId?: string; deliveryOfficeId?: string },
    page = 1,
    limit = 20,
  ): Promise<{ summary: DeliveryRatingSummary; items: DeliveryRatingView[]; hasNextPage: boolean }> {
    let filter: DeliveryRatingFilter;
    if (actor.role === UserRole.COURIER) {
      filter = { courierId: (await this.requireCourier(actor.userId)).id };
    } else if (actor.role === UserRole.DELIVERY_MANAGER) {
      const office = await this.requireOffice(actor.userId);
      filter = { deliveryOfficeId: office.id };
      if (query.courierId) {
        const courier = await this.getCourierById(query.courierId);
        if (courier.deliveryOfficeId !== office.id) throw new ForbiddenError("courier_not_in_your_office");
        filter.courierId = courier.id;
      }
    } else if (actor.role === UserRole.ADMIN) {
      filter = { courierId: query.courierId || undefined, deliveryOfficeId: query.deliveryOfficeId || undefined };
    } else {
      throw new ForbiddenError();
    }

    const [summary, rows] = await Promise.all([
      this.ratingRepo.summary(filter),
      this.ratingRepo.list(filter, limit + 1, (page - 1) * limit),
    ]);
    return { summary, items: rows.slice(0, limit), hasNextPage: rows.length > limit };
  }

  // ── Status changes ───────────────────────────────────────────────────────────

  async updateDeliveryStatus(deliveryId: string, dto: UpdateDeliveryStatusDto, actor: Actor): Promise<void> {
    // F8: validate on the raw row before any cross-service calls
    const delivery = await this.deliveryRepo.findById(deliveryId);
    if (!delivery) throw new NotFoundError("delivery_not_found");

    // S1: only the assigned courier, the owning office, or an admin
    if ((await this.resolveDeliveryAccess(delivery, actor)) !== "full") throw new NotFoundError("delivery_not_found");

    // Accepting and assigning have their own endpoints (office checks, fees, SLAs)
    if (dto.status === DeliveryStatus.ACCEPTED || dto.status === DeliveryStatus.ASSIGNED) {
      throw new ValidationError("use_accept_or_assign_endpoint");
    }
    if (dto.status === DeliveryStatus.FAILED && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenError("only_admin_can_fail_delivery");
    }
    if (!this.isValidStatusTransition(delivery.status, dto.status)) {
      throw new ValidationError(`Cannot transition from ${delivery.status} to ${dto.status}`);
    }

    const [enriched] = await this.enrichDeliveriesWithOrderData([delivery], actor.userId, () => false);
    // Prefer the status-filtered vendor orders (excludes any cancelled after this delivery was
    // created); fall back to raw pickup locations only if order-data enrichment failed above.
    const vendorOrdersIds = enriched.vendorOrders
      ? enriched.vendorOrders.map((vo: any) => vo.id)
      : enriched.pickupLocations?.map((location: PickupLocation) => location?.vendorOrderId);
    const routing = { deliveryOfficeId: delivery.deliveryOfficeId ?? null, courierId: delivery.courierId };
    const base = { deliveryId, customerOrderId: delivery.customerOrderId, customerId: delivery.customerId, ...routing };

    const updates: Partial<Delivery> = { status: dto.status, notes: dto.notes };
    const afterCommit: (() => Promise<void>)[] = [];

    if (dto.status === DeliveryStatus.PICKED_UP) {
      updates.pickedUpAt = new Date();
      afterCommit.push(() => this.slaManager?.cancelPickupSla(deliveryId) ?? Promise.resolve());
      afterCommit.push(() => this.publisher.publishOrderPickedUp({ ...base, vendorOrdersIds }));
    } else if (dto.status === DeliveryStatus.ON_THE_WAY) {
      afterCommit.push(() => this.publisher.publishOrderOnTheWay({ ...base, vendorOrdersIds }));
    } else if (dto.status === DeliveryStatus.DELIVERED) {
      updates.deliveredAt = new Date();
      // Cash on delivery: the courier now holds what the customer paid for this delivery
      updates.cashCollectedAmount = round2((delivery.totalPrice || 0) + (delivery.deliveryFee || 0));
      afterCommit.push(() => this.slaManager?.cancelAllSlas(deliveryId) ?? Promise.resolve());
      const items =
        enriched.vendorOrders?.flatMap(
          (vo: any) =>
            vo.items?.map((item: any) => ({
              vendorProductId: item.vendorProductId,
              quantity: item.quantity,
              actualWeightGrams: item.actualWeightGrams,
              vendorUserId: vo.vendorUserId,
            })) || [],
        ) || [];
      afterCommit.push(() => this.publisher.publishOrderDelivered({ ...base, items, vendorOrdersIds }));
    } else if (dto.status === DeliveryStatus.FAILED) {
      afterCommit.push(() => this.slaManager?.cancelAllSlas(deliveryId) ?? Promise.resolve());
      afterCommit.push(() => this.publisher.publishDeliveryFailed(base));
    }

    // F7: status, courier availability and counters change together
    await this.db.withTransaction(async (connection) => {
      const locked = await this.deliveryRepo.findByIdForUpdate(deliveryId, connection);
      if (!locked || !this.isValidStatusTransition(locked.status, dto.status)) {
        throw new ValidationError(`Cannot transition from ${locked?.status} to ${dto.status}`);
      }
      await this.deliveryRepo.update(deliveryId, updates, connection);
      if (delivery.courierId && (dto.status === DeliveryStatus.DELIVERED || dto.status === DeliveryStatus.FAILED)) {
        await this.courierRepo.updateAvailability(delivery.courierId, true, connection);
        if (dto.status === DeliveryStatus.DELIVERED) await this.courierRepo.incrementDeliveries(delivery.courierId, connection);
      }
    });

    for (const step of afterCommit) {
      await step().catch((err) => Logger.error(`Post-status step failed for delivery ${deliveryId}`, err));
    }
  }

  async acceptDelivery(deliveryId: string, userId: string): Promise<void> {
    const office = await this.requireOffice(userId);
    if (!office.isActive) throw new ForbiddenError("delivery_office_inactive");

    const delivery = await this.deliveryRepo.findById(deliveryId);
    if (!delivery) throw new NotFoundError("delivery_not_found");
    if (!this.isUnclaimed(delivery)) throw new ValidationError("delivery_already_accepted_by_another_office");

    const fees = await this.computeFeeSplit(delivery, "OFFICE");
    const accepted = await this.deliveryRepo.acceptDelivery(deliveryId, office.id, fees);
    if (!accepted) throw new ValidationError("delivery_already_accepted_by_another_office");

    try {
      await this.slaManager?.cancelAcceptanceSla(deliveryId);
      await this.slaManager?.cancelFreelanceOpen(deliveryId);
      await this.slaManager?.scheduleAssignmentSla({ deliveryId, customerOrderId: delivery.customerOrderId, customerId: delivery.customerId, deliveryOfficeId: office.id });
      await this.publisher.publishDeliveryAccepted({ deliveryId, officeId: office.id });
    } catch (err) {
      Logger.error(`Post-accept step failed for delivery ${deliveryId}`, err);
    }
  }

  async cancelDeliveryByManager(deliveryId: string, userId: string, reason: string): Promise<void> {
    const office = await this.requireOffice(userId);

    const delivery = await this.deliveryRepo.findById(deliveryId);
    if (!delivery) throw new NotFoundError("delivery_not_found");
    if (delivery.deliveryOfficeId !== office.id) throw new ValidationError("not_your_delivery");
    if (delivery.status !== DeliveryStatus.ACCEPTED) throw new ValidationError("invalid_delivery_status_for_cancellation");

    await this.deliveryRepo.update(deliveryId, { status: DeliveryStatus.FAILED, notes: reason });
    // F9: nothing should fire for a failed delivery
    await this.slaManager?.cancelAllSlas(deliveryId);
    await this.publisher.publishDeliveryFailed({
      deliveryId,
      customerOrderId: delivery.customerOrderId,
      customerId: delivery.customerId,
      deliveryOfficeId: office.id,
    });
  }

  async assignCourier(deliveryId: string, dto: AssignCourierDto, actor: Actor): Promise<void> {
    let delivery: Delivery | null = null;
    let courier: Courier | null = null;

    await this.db.withTransaction(async (connection) => {
      delivery = await this.deliveryRepo.findByIdForUpdate(deliveryId, connection);
      if (!delivery) throw new NotFoundError("delivery_not_found");

      if (delivery.status !== DeliveryStatus.ACCEPTED) {
        throw new ValidationError("delivery_must_be_accepted_before_assignment");
      }

      if (actor.role === UserRole.DELIVERY_MANAGER) {
        const office = await this.requireOffice(actor.userId);
        if (delivery.deliveryOfficeId !== office.id) {
          throw new ValidationError("delivery_not_assigned_to_your_office");
        }
      }

      // S5: lock the courier row so two deliveries can't take the same courier
      courier = await this.courierRepo.findByIdForUpdate(dto.courierId, connection);
      if (!courier) throw new NotFoundError("courier_not_found");
      if (courier.courierType !== "OFFICE" || courier.deliveryOfficeId !== delivery.deliveryOfficeId) {
        throw new ValidationError("courier_not_in_delivery_office");
      }
      if (courier.approvalStatus !== "APPROVED") throw new ValidationError("courier_not_approved");
      if (!courier.isActive || !courier.isAvailable) throw new ValidationError("courier_not_available");

      await this.deliveryRepo.assignCourier(deliveryId, dto.courierId, connection);
      await this.courierRepo.updateAvailability(dto.courierId, false, connection);
    });

    const d = delivery as unknown as Delivery;
    const c = courier as unknown as Courier;
    try {
      await this.slaManager?.cancelAssignmentSla(deliveryId);
      await this.slaManager?.schedulePickupSla({ deliveryId, customerOrderId: d.customerOrderId, customerId: d.customerId, courierId: c.id, deliveryOfficeId: d.deliveryOfficeId });
      await this.publisher.publishCourierAssigned({
        deliveryId,
        courierId: c.id,
        courierUserId: c.userId,
        customerId: d.customerId,
        customerOrderId: d.customerOrderId,
        deliveryOfficeId: d.deliveryOfficeId,
        fulfillmentType: "OFFICE",
      });
    } catch (err) {
      Logger.error(`Post-assign step failed for delivery ${deliveryId}`, err);
    }
  }

  // Freelancer takes a delivery from the pool (§3.2). The conditional UPDATE in
  // claimDelivery is what decides the race; the courier row lock keeps one courier
  // from claiming two deliveries at once.
  async claimDelivery(deliveryId: string, userId: string): Promise<void> {
    this.assertFreelanceEnabled();
    let delivery: Delivery | null = null;
    let courier: Courier | null = null;

    await this.db.withTransaction(async (connection) => {
      const own = await this.requireCourier(userId);
      courier = await this.courierRepo.findByIdForUpdate(own.id, connection);
      if (!courier) throw new NotFoundError("courier_not_found_by_user");
      this.assertApprovedFreelancer(courier);
      if (!courier.isAvailable) throw new ValidationError("courier_not_available");

      const { freelanceMaxCashHeld } = this.dispatcher.config;
      if (freelanceMaxCashHeld > 0) {
        const cashHeld = await this.deliveryRepo.sumUnsettledCashForCourier(courier.id, connection);
        if (cashHeld > freelanceMaxCashHeld) throw new ValidationError("cash_limit_reached_settle_first");
      }

      delivery = await this.deliveryRepo.findById(deliveryId, connection);
      if (!delivery) throw new NotFoundError("delivery_not_found");
      if (this.dispatcher.config.freelanceRadiusKm > 0 && (courier.lastLatitude == null || courier.lastLongitude == null)) {
        throw new ValidationError("courier_location_required");
      }
      if (!this.dispatcher.isWithinRadius(courier, delivery)) throw new ValidationError("delivery_out_of_range");

      const fees = await this.computeFeeSplit(delivery, "FREELANCE");
      const claimed = await this.deliveryRepo.claimDelivery(deliveryId, courier.id, fees, connection);
      if (!claimed) throw new ValidationError("delivery_no_longer_available");
      await this.courierRepo.updateAvailability(courier.id, false, connection);
    });

    const d = delivery as unknown as Delivery;
    const c = courier as unknown as Courier;
    try {
      await this.slaManager?.cancelAcceptanceSla(deliveryId);
      await this.slaManager?.cancelFreelanceOpen(deliveryId);
      await this.slaManager?.schedulePickupSla({ deliveryId, customerOrderId: d.customerOrderId, customerId: d.customerId, courierId: c.id });
      await this.publisher.publishCourierAssigned({
        deliveryId,
        courierId: c.id,
        courierUserId: c.userId,
        customerId: d.customerId,
        customerOrderId: d.customerOrderId,
        deliveryOfficeId: null,
        fulfillmentType: "FREELANCE",
      });
      await this.publisher.publishDeliveryClaimed({ deliveryId, courierId: c.id });
    } catch (err) {
      Logger.error(`Post-claim step failed for delivery ${deliveryId}`, err);
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
      [DeliveryStatus.FAILED]: [],
    };

    return transitions[currentStatus]?.includes(newStatus) || false;
  }

  // The customer is unreachable / refused / wrong address (the Courier app's reasons):
  // the order fails and user-service records a customer penalty. Not for a courier who
  // just can't make it; that's releaseDeliveryByCourier.
  async cancelDeliveryByCourier(deliveryId: string, courierId: string, reason: string): Promise<void> {
    let delivery: Delivery | null = null;
    await this.db.withTransaction(async (connection) => {
      delivery = await this.deliveryRepo.findByIdForUpdate(deliveryId, connection);
      if (!delivery) throw new NotFoundError("delivery_not_found");
      if (delivery.courierId !== courierId) throw new ValidationError("not_your_delivery");
      if (delivery.status !== DeliveryStatus.ASSIGNED) throw new ValidationError("invalid_delivery_status_for_cancellation");

      await this.deliveryRepo.update(deliveryId, { status: DeliveryStatus.FAILED, notes: reason }, connection);
      await this.courierRepo.updateAvailability(courierId, true, connection);
    });

    const d = delivery as unknown as Delivery;
    await this.slaManager?.cancelAllSlas(deliveryId);
    await this.publisher.publishDeliveryFailedByCourier({
      deliveryId,
      customerOrderId: d.customerOrderId,
      customerId: d.customerId,
      reason,
      deliveryOfficeId: d.deliveryOfficeId ?? null,
      courierId,
    });
  }

  // F4: the courier backs out before pickup. The order survives: an office delivery goes
  // back to the office for reassignment, a freelance one goes back to the pool.
  async releaseDeliveryByCourier(deliveryId: string, userId: string, reason?: string): Promise<void> {
    const courier = await this.requireCourier(userId);
    let delivery: Delivery | null = null;

    await this.db.withTransaction(async (connection) => {
      delivery = await this.deliveryRepo.findByIdForUpdate(deliveryId, connection);
      if (!delivery) throw new NotFoundError("delivery_not_found");
      if (delivery.courierId !== courier.id) throw new ValidationError("not_your_delivery");
      if (delivery.status !== DeliveryStatus.ASSIGNED) throw new ValidationError("can_only_release_before_pickup");

      if (delivery.fulfillmentType === "FREELANCE") await this.deliveryRepo.returnToPending(deliveryId, connection);
      else await this.deliveryRepo.revertToAccepted(deliveryId, connection);
      await this.courierRepo.incrementCancellations(courier.id, connection);
      // Offline until they choose to come back, so they aren't handed the next job right away
      await this.courierRepo.updateAvailability(courier.id, false, connection);
    });

    const d = delivery as unknown as Delivery;
    const params = { deliveryId, customerOrderId: d.customerOrderId, customerId: d.customerId };
    try {
      await this.slaManager?.cancelPickupSla(deliveryId);
      if (d.fulfillmentType === "FREELANCE") {
        await this.slaManager?.scheduleAcceptanceSla(params);
        await this.publisher.publishDeliveryReturnedToPool({ deliveryId, customerId: d.customerId, customerOrderId: d.customerOrderId, previousCourierId: courier.id, reason: "courier_released" });
        const fresh = await this.deliveryRepo.findById(deliveryId);
        if (fresh) await this.dispatcher.notifyDeliveryOpen(fresh);
      } else {
        await this.slaManager?.scheduleAssignmentSla({ ...params, deliveryOfficeId: d.deliveryOfficeId });
        const office = d.deliveryOfficeId ? await this.officeRepo.findById(d.deliveryOfficeId) : null;
        await this.publisher.publishDeliveryReleasedByCourier({
          deliveryId,
          customerOrderId: d.customerOrderId,
          customerId: d.customerId,
          deliveryOfficeId: d.deliveryOfficeId as string,
          officeUserId: office?.userId,
          courierId: courier.id,
          reason,
        });
      }
    } catch (err) {
      Logger.error(`Post-release step failed for delivery ${deliveryId}`, err);
    }
  }

  async getVendorDeliveriesCount(vendorOrderIds: string[], periodStart?: Date, periodEnd?: Date): Promise<number> {
    return this.deliveryRepo.countByVendorOrderIds(vendorOrderIds, periodStart, periodEnd);
  }
}

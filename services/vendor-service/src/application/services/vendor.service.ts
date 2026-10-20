import { randomUUID } from "crypto";
import { IVendorRepository, VendorRegistrationFields } from "../../core/interfaces/vendor.repository";
import { IWorkingHoursRepository } from "../../core/interfaces/working-hours.repository";
import { Vendor, VendorApprovalHistoryEntry } from "../../core/entities/vendor.entity";
import { WorkingHours } from "../../core/entities/working-hours.entity";
import { CreateVendorDto, UpdateVendorDto, SetWorkingHoursDto, RegisterVendorDto } from "../../core/dto/vendor.dto";
import { ShopStatus, UserRole, VendorApprovalStatus, VendorType, ForbiddenError } from "@city-market/shared";
import { ValidationError, NotFoundError } from "@city-market/shared";
import { Database, Logger } from "@city-market/shared/node";
import { VendorPublisher } from "../../infrastructure/messaging/VendorPublisher";
import { MediaClient } from "../../infrastructure/http/media-client";

// Who is calling: a VENDOR may only touch their own store; an ADMIN (or a service token,
// which has no user) may touch any.
export interface VendorActor {
  userId?: string;
  role?: UserRole;
}

const PHONE_RE = /^\+?[0-9]{10,15}$/;
const MAX_TEXT = 255;
const MAX_NOTE = 1000;

// Registration documents live in media-service's vendor-documents folder
const isVendorDocumentUrl = (url?: string | null): url is string =>
  typeof url === "string" && /^https?:\/\/[^\s]+\/vendor-documents\/[^\s]+$/.test(url) && url.length <= 512;

// Admin decisions. A merchant moves REJECTED -> PENDING_REVIEW only by resubmitting.
const APPROVAL_TRANSITIONS: Record<VendorApprovalStatus, VendorApprovalStatus[]> = {
  [VendorApprovalStatus.PENDING_REVIEW]: [VendorApprovalStatus.APPROVED, VendorApprovalStatus.REJECTED],
  [VendorApprovalStatus.REJECTED]: [VendorApprovalStatus.APPROVED],
  [VendorApprovalStatus.APPROVED]: [VendorApprovalStatus.SUSPENDED],
  [VendorApprovalStatus.SUSPENDED]: [VendorApprovalStatus.APPROVED],
};

export class VendorService {
  constructor(
    private vendorRepo: IVendorRepository,
    private workingHoursRepo: IWorkingHoursRepository,
    private publisher: VendorPublisher,
    private db: Database,
    private mediaClient: MediaClient = new MediaClient(),
  ) {}

  // Admin (or seed / service) creates a store for an existing VENDOR user. The admin vetted
  // it, so it starts APPROVED.
  async createVendor(dto: CreateVendorDto): Promise<Vendor> {
    if (!dto.userId) throw new ValidationError("user_id_required");
    // Check if vendor already exists for this user
    const existing = await this.vendorRepo.findByUserId(dto.userId);
    if (existing) {
      throw new ValidationError("vendor_already_exists");
    }

    const vendor: Vendor = {
      id: randomUUID(),
      userId: dto.userId,
      shopName: dto.shopName,
      shopDescription: dto.shopDescription,
      phone: dto.phone,
      address: dto.address,
      latitude: dto.latitude,
      longitude: dto.longitude,
      type: dto.type,
      status: ShopStatus.CLOSED,
      averageRating: 0.0,
      totalRatings: 0,
      isActive: true,
      approvalStatus: VendorApprovalStatus.APPROVED,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.vendorRepo.create(vendor);

    // Emit event
    await this.publisher.publishVendorRegistered(vendor.id, vendor.userId);

    return vendor;
  }

  // ── Merchant self-registration ──────────────────────────────────────────────

  // A VENDOR user applies for a store. It exists as PENDING_REVIEW (shop CLOSED) until an
  // admin approves it; until then every shop operation is refused (assertCanOperate).
  async registerVendor(userId: string, dto: RegisterVendorDto): Promise<Vendor> {
    const fields = this.validateRegistration(dto);
    if (await this.vendorRepo.findByUserId(userId)) throw new ValidationError("vendor_already_exists");

    const now = new Date();
    const vendor: Vendor = {
      id: randomUUID(),
      userId,
      ...fields,
      shopDescription: fields.shopDescription,
      status: ShopStatus.CLOSED,
      averageRating: 0,
      totalRatings: 0,
      isActive: true,
      approvalStatus: VendorApprovalStatus.PENDING_REVIEW,
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.withTransaction(async (connection) => {
      await this.vendorRepo.create(vendor, connection);
      await this.vendorRepo.addApprovalHistory(this.historyEntry(vendor.id, VendorApprovalStatus.PENDING_REVIEW, "submitted", userId), connection);
    });
    await this.publisher
      .publishVendorRegistered(vendor.id, vendor.userId, { shopName: vendor.shopName, approvalStatus: vendor.approvalStatus })
      .catch((err) => Logger.warn(`VENDOR_REGISTERED publish failed: ${err.message}`));
    return vendor;
  }

  // Corrects the application: allowed while it waits for review or after a rejection.
  // The status is never taken from the request; resubmitting always means PENDING_REVIEW.
  async resubmitRegistration(userId: string, dto: RegisterVendorDto): Promise<Vendor> {
    const fields = this.validateRegistration(dto);
    const own = await this.vendorRepo.findByUserId(userId);
    if (!own) throw new NotFoundError("vendor_not_found");

    await this.db.withTransaction(async (connection) => {
      const vendor = await this.vendorRepo.findByIdForUpdate(own.id, connection);
      if (!vendor) throw new NotFoundError("vendor_not_found");
      if (vendor.approvalStatus !== VendorApprovalStatus.PENDING_REVIEW && vendor.approvalStatus !== VendorApprovalStatus.REJECTED) {
        throw new ValidationError("vendor_application_not_editable");
      }
      await this.vendorRepo.resubmitRegistration(vendor.id, fields, connection);
      await this.vendorRepo.addApprovalHistory(this.historyEntry(vendor.id, VendorApprovalStatus.PENDING_REVIEW, "resubmitted", userId), connection);
    });
    const updated = await this.getVendorById(own.id);
    await this.publisher
      .publishVendorRegistered(updated.id, updated.userId, { shopName: updated.shopName, approvalStatus: VendorApprovalStatus.PENDING_REVIEW, resubmitted: true })
      .catch((err) => Logger.warn(`VENDOR_REGISTERED publish failed: ${err.message}`));
    return updated;
  }

  // ── Admin review ────────────────────────────────────────────────────────────

  async setApproval(vendorId: string, status: VendorApprovalStatus, note: string | undefined, adminUserId?: string): Promise<Vendor> {
    if (!Object.values(VendorApprovalStatus).includes(status) || status === VendorApprovalStatus.PENDING_REVIEW) {
      throw new ValidationError("invalid_approval_status");
    }
    const trimmed = typeof note === "string" ? note.trim() : "";
    if (trimmed.length > MAX_NOTE) throw new ValidationError("review_note_too_long");
    // The merchant must be told why
    if ((status === VendorApprovalStatus.REJECTED || status === VendorApprovalStatus.SUSPENDED) && !trimmed) {
      throw new ValidationError("review_note_required");
    }

    let vendor: Vendor | null = null;
    await this.db.withTransaction(async (connection) => {
      vendor = await this.vendorRepo.findByIdForUpdate(vendorId, connection);
      if (!vendor) throw new NotFoundError("vendor_not_found");
      if (!APPROVAL_TRANSITIONS[vendor.approvalStatus]?.includes(status)) {
        throw new ValidationError("invalid_approval_transition");
      }
      await this.vendorRepo.setApproval(vendorId, status, trimmed || null, connection);
      // A store that may not operate must not take orders either
      if (status !== VendorApprovalStatus.APPROVED && vendor.status === ShopStatus.OPEN) {
        await this.vendorRepo.updateStatus(vendorId, ShopStatus.CLOSED, connection);
      }
      await this.vendorRepo.addApprovalHistory(this.historyEntry(vendorId, status, trimmed || null, adminUserId ?? null), connection);
    });

    const v = vendor as unknown as Vendor;
    await this.publisher
      .publishVendorApprovalUpdated({ vendorId, vendorUserId: v.userId, approvalStatus: status, note: trimmed || null })
      .catch((err) => Logger.warn(`Failed to publish VENDOR_APPROVAL_UPDATED for ${vendorId}: ${err.message}`));
    return this.getVendorById(vendorId);
  }

  async getApprovalHistory(vendorId: string): Promise<VendorApprovalHistoryEntry[]> {
    await this.getVendorById(vendorId);
    return this.vendorRepo.findApprovalHistory(vendorId);
  }

  // ── Authorization helpers ───────────────────────────────────────────────────

  // The store a caller may manage. A VENDOR may only manage their own store (the id in the
  // URL must be theirs); ADMIN and service tokens may manage any.
  async getManageableVendor(vendorId: string, actor: VendorActor): Promise<Vendor> {
    const vendor = await this.getVendorById(vendorId);
    if (actor.role === UserRole.VENDOR && vendor.userId !== actor.userId) throw new ForbiddenError("not_your_store");
    return vendor;
  }

  // Shop operations (open the shop, products, working hours) need an approved, active store.
  // Admins may still act on any store.
  assertCanOperate(vendor: Vendor, actor: VendorActor): void {
    if (actor.role !== UserRole.VENDOR) return;
    if (!vendor.isActive) throw new ForbiddenError("vendor_inactive");
    if (vendor.approvalStatus !== VendorApprovalStatus.APPROVED) throw new ForbiddenError("vendor_not_approved");
  }

  // ── Reads ───────────────────────────────────────────────────────────────────

  async getVendorById(id: string): Promise<Vendor> {
    const vendor = await this.vendorRepo.findById(id);
    if (!vendor) {
      throw new NotFoundError("vendor_not_found");
    }
    return vendor;
  }

  async getVendorByUserId(userId: string): Promise<Vendor> {
    const vendor = await this.vendorRepo.findByUserId(userId);
    if (!vendor) {
      throw new NotFoundError("vendor_not_found");
    }
    return vendor;
  }

  async getAllVendors(page: number = 1, limit: number = 20, approvalStatus?: VendorApprovalStatus): Promise<Vendor[]> {
    const offset = (page - 1) * limit;
    return this.vendorRepo.findAll(limit, offset, approvalStatus);
  }

  async countVendors(): Promise<number> {
    return this.vendorRepo.countAll();
  }

  async getVendorsByIds(ids: string[]): Promise<Vendor[]> {
    return this.vendorRepo.findByIds(ids);
  }

  async getOpenVendors(): Promise<Vendor[]> {
    return this.vendorRepo.findByStatus(ShopStatus.OPEN);
  }

  // ── Store management (ownership checked by the caller via getManageableVendor) ──

  async updateVendor(id: string, dto: UpdateVendorDto, actor: VendorActor): Promise<void> {
    const vendor = await this.getManageableVendor(id, actor);
    this.assertCanOperate(vendor, actor);
    // Only profile fields; approval, documents and ratings have their own paths
    const { shopName, shopDescription, phone, address, latitude, longitude, type } = dto as UpdateVendorDto & { type?: string };
    const update: Partial<Vendor> = { shopName, shopDescription, phone, address, latitude, longitude };
    // The store category is part of the reviewed application; only an admin changes it
    if (actor.role !== UserRole.VENDOR && type) update.type = type;
    await this.vendorRepo.update(id, update);
  }

  async updateVendorStatus(id: string, status: ShopStatus, actor: VendorActor): Promise<void> {
    if (!Object.values(ShopStatus).includes(status)) throw new ValidationError("invalid_shop_status");
    const vendor = await this.getManageableVendor(id, actor);
    this.assertCanOperate(vendor, actor);
    // SUSPENDED is an admin decision, not something a merchant sets on their own shop
    if (actor.role === UserRole.VENDOR && status === ShopStatus.SUSPENDED) throw new ForbiddenError("vendor_cannot_suspend_shop");
    // Nobody opens a store that isn't approved
    if (status === ShopStatus.OPEN && (vendor.approvalStatus !== VendorApprovalStatus.APPROVED || !vendor.isActive)) {
      throw new ValidationError("vendor_not_approved");
    }
    await this.vendorRepo.updateStatus(id, status);
  }

  async setWorkingHours(vendorId: string, dto: SetWorkingHoursDto, actor: VendorActor): Promise<void> {
    const vendor = await this.getManageableVendor(vendorId, actor);
    this.assertCanOperate(vendor, actor);

    const workingHours: WorkingHours = {
      id: randomUUID(),
      vendorId,
      dayOfWeek: dto.dayOfWeek,
      openTime: dto.openTime,
      closeTime: dto.closeTime,
      isOpen: dto.isOpen,
    };

    await this.workingHoursRepo.upsert(workingHours);
  }

  async getWorkingHours(vendorId: string): Promise<WorkingHours[]> {
    return this.workingHoursRepo.findByVendorId(vendorId);
  }

  async updateStoreImage(id: string, imagePath: string, actor: VendorActor): Promise<void> {
    const vendor = await this.getManageableVendor(id, actor);
    this.assertCanOperate(vendor, actor);
    await this.vendorRepo.update(id, { storeImage: imagePath });
    await this.mediaClient.deleteOldImage(vendor.storeImage, imagePath);
  }

  async updateVendorRating(id: string, averageRating: number, totalRatings: number): Promise<void> {
    await this.vendorRepo.updateRating(id, averageRating, totalRatings);
    Logger.info(`Vendor ${id} rating updated to ${averageRating} (${totalRatings} ratings)`);
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private validateRegistration(dto: RegisterVendorDto): VendorRegistrationFields {
    const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const shopName = text(dto.shopName);
    const ownerName = text(dto.ownerName);
    const address = text(dto.address);
    const phone = text(dto.phone).replace(/[\s-]/g, "");
    const shopDescription = text(dto.shopDescription);
    const latitude = Number(dto.latitude);
    const longitude = Number(dto.longitude);

    if (!shopName || !ownerName || !address) throw new ValidationError("vendor_name_owner_address_required");
    if (shopName.length > MAX_TEXT || ownerName.length > MAX_TEXT) throw new ValidationError("vendor_field_too_long");
    if (shopDescription.length > MAX_NOTE) throw new ValidationError("vendor_field_too_long");
    if (!PHONE_RE.test(phone)) throw new ValidationError("invalid_phone");
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (latitude === 0 && longitude === 0)) {
      throw new ValidationError("vendor_location_required");
    }
    if (!dto.type || !(Object.values(VendorType) as string[]).includes(dto.type)) throw new ValidationError("invalid_vendor_type");
    if (!isVendorDocumentUrl(dto.ownerNationalIdUrl)) throw new ValidationError("national_id_document_required");
    if (!isVendorDocumentUrl(dto.commercialRegisterUrl)) throw new ValidationError("commercial_register_document_required");
    if (dto.taxCardUrl != null && dto.taxCardUrl !== "" && !isVendorDocumentUrl(dto.taxCardUrl)) throw new ValidationError("invalid_document_url");

    return {
      shopName,
      shopDescription: shopDescription || undefined,
      ownerName,
      phone,
      address,
      latitude,
      longitude,
      type: dto.type,
      ownerNationalIdUrl: dto.ownerNationalIdUrl,
      commercialRegisterUrl: dto.commercialRegisterUrl,
      taxCardUrl: dto.taxCardUrl || null,
    };
  }

  private historyEntry(vendorId: string, status: VendorApprovalStatus, note: string | null, actorUserId: string | null): VendorApprovalHistoryEntry {
    return { id: randomUUID(), vendorId, approvalStatus: status, note, actorUserId, createdAt: new Date() };
  }
}

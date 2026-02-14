import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { IVendorRepository } from "../../core/interfaces/vendor.repository";
import { IWorkingHoursRepository } from "../../core/interfaces/working-hours.repository";
import { Vendor } from "../../core/entities/vendor.entity";
import { WorkingHours } from "../../core/entities/working-hours.entity";
import { CreateVendorDto, UpdateVendorDto, SetWorkingHoursDto } from "../../core/dto/vendor.dto";
import { ShopStatus } from "@city-market/shared";
import { ValidationError, NotFoundError } from "@city-market/shared";
import { Logger } from "@city-market/shared/node";
import { EventBus, BaseEvent, EventType } from "@city-market/shared";

export class VendorService {
  constructor(
    private vendorRepo: IVendorRepository,
    private workingHoursRepo: IWorkingHoursRepository,
    private eventBus: EventBus
  ) { }

  async createVendor(dto: CreateVendorDto): Promise<Vendor> {
    // Check if vendor already exists for this user
    const existing = await this.vendorRepo.findByUserId(dto.userId);
    if (existing) {
      throw new ValidationError("Vendor already exists for this user");
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
      status: ShopStatus.CLOSED,
      commissionRate: 10.0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.vendorRepo.create(vendor);

    // Emit event
    await this.eventBus.publish({
      id: randomUUID(),
      type: EventType.VENDOR_REGISTERED,
      timestamp: new Date(),
      payload: { vendorId: vendor.id, userId: vendor.userId },
    });

    return vendor;
  }

  async getVendorById(id: string): Promise<Vendor> {
    const vendor = await this.vendorRepo.findById(id);
    if (!vendor) {
      throw new NotFoundError("Vendor not found");
    }
    return vendor;
  }

  async getVendorByUserId(userId: string): Promise<Vendor> {
    const vendor = await this.vendorRepo.findByUserId(userId);
    if (!vendor) {
      throw new NotFoundError("Vendor not found");
    }
    return vendor;
  }

  async getAllVendors(page: number = 1, limit: number = 20): Promise<Vendor[]> {
    const offset = (page - 1) * limit;
    return this.vendorRepo.findAll(limit, offset);
  }

  async getOpenVendors(): Promise<Vendor[]> {
    return this.vendorRepo.findByStatus(ShopStatus.OPEN);
  }

  async updateVendor(id: string, dto: UpdateVendorDto): Promise<void> {
    const vendor = await this.getVendorById(id);
    await this.vendorRepo.update(id, dto);
  }

  async updateVendorStatus(id: string, status: ShopStatus): Promise<void> {
    const vendor = await this.getVendorById(id);
    await this.vendorRepo.updateStatus(id, status);
  }

  async setWorkingHours(vendorId: string, dto: SetWorkingHoursDto): Promise<void> {
    const vendor = await this.getVendorById(vendorId);

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

  async updateStoreImage(id: string, imagePath: string): Promise<void> {
    const vendor = await this.getVendorById(id);

    // Delete old image if it exists
    if (vendor.storeImage) {
      try {
        const oldImagePath = path.join(process.cwd(), vendor.storeImage.replace("/vendors", ""));
        await fs.unlink(oldImagePath);
        Logger.info("Old store image deleted", { path: oldImagePath });
      } catch (error) {
        Logger.error("Failed to delete old store image", { error });
      }
    }

    await this.vendorRepo.update(id, { storeImage: imagePath });
  }
}

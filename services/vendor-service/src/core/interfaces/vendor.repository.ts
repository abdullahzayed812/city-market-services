import { PoolConnection } from "mysql2/promise";
import { VendorApprovalStatus } from "@city-market/shared";
import { Vendor, VendorApprovalHistoryEntry } from "../entities/vendor.entity";

export interface VendorRegistrationFields {
  shopName: string;
  shopDescription?: string;
  ownerName: string;
  phone: string;
  address: string;
  latitude: number;
  longitude: number;
  type: string;
  ownerNationalIdUrl: string;
  commercialRegisterUrl: string;
  taxCardUrl: string | null;
}

export interface IVendorRepository {
  create(vendor: Vendor, connection?: PoolConnection): Promise<Vendor>;
  findById(id: string, connection?: PoolConnection): Promise<Vendor | null>;
  findByIdForUpdate(id: string, connection: PoolConnection): Promise<Vendor | null>;
  findByUserId(userId: string): Promise<Vendor | null>;
  findAll(limit: number, offset: number, approvalStatus?: VendorApprovalStatus): Promise<Vendor[]>;
  countAll(): Promise<number>;
  findByIds(ids: string[]): Promise<Vendor[]>;
  findByStatus(status: string): Promise<Vendor[]>;
  update(id: string, data: Partial<Vendor>): Promise<void>;
  updateStatus(id: string, status: string, connection?: PoolConnection): Promise<void>;
  updateRating(id: string, averageRating: number, totalRatings: number): Promise<void>;
  // A rejected merchant's corrected application; back to PENDING_REVIEW
  resubmitRegistration(id: string, fields: VendorRegistrationFields, connection: PoolConnection): Promise<void>;
  setApproval(id: string, status: VendorApprovalStatus, note: string | null, connection: PoolConnection): Promise<void>;
  addApprovalHistory(entry: VendorApprovalHistoryEntry, connection: PoolConnection): Promise<void>;
  findApprovalHistory(vendorId: string): Promise<VendorApprovalHistoryEntry[]>;
}

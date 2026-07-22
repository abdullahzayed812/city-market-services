import { Vendor } from "../entities/vendor.entity";

export interface IVendorRepository {
  create(vendor: Vendor): Promise<Vendor>;
  findById(id: string): Promise<Vendor | null>;
  findByUserId(userId: string): Promise<Vendor | null>;
  findAll(limit: number, offset: number): Promise<Vendor[]>;
  countAll(): Promise<number>;
  findByIds(ids: string[]): Promise<Vendor[]>;
  findByStatus(status: string): Promise<Vendor[]>;
  update(id: string, data: Partial<Vendor>): Promise<void>;
  updateStatus(id: string, status: string): Promise<void>;
  updateRating(id: string, averageRating: number, totalRatings: number): Promise<void>;
}

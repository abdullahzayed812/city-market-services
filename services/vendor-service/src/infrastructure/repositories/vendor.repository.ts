import { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { VendorApprovalStatus } from "@city-market/shared";
import { Vendor, VendorApprovalHistoryEntry } from "../../core/entities/vendor.entity";
import { IVendorRepository, VendorRegistrationFields } from "../../core/interfaces/vendor.repository";
import { Database } from "@city-market/shared/node";

export class VendorRepository implements IVendorRepository {
  private pool: Pool;

  constructor(private db: Database) {
    this.pool = this.db.getPool();
  }

  async create(vendor: Vendor, connection?: PoolConnection): Promise<Vendor> {
    const query = `
      INSERT INTO vendors (
        id, user_id, shop_name, shop_description, phone, address,
        latitude, longitude, store_image, type, status, is_active,
        approval_status, owner_name, owner_national_id_url, commercial_register_url, tax_card_url, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await (connection || this.pool).execute(query, [
      vendor.id,
      vendor.userId,
      vendor.shopName,
      vendor.shopDescription || null,
      vendor.phone,
      vendor.address,
      vendor.latitude || null,
      vendor.longitude || null,
      vendor.storeImage || null,
      vendor.type || null,
      vendor.status,
      vendor.isActive,
      vendor.approvalStatus,
      vendor.ownerName ?? null,
      vendor.ownerNationalIdUrl ?? null,
      vendor.commercialRegisterUrl ?? null,
      vendor.taxCardUrl ?? null,
      vendor.submittedAt ?? null,
    ]);
    return vendor;
  }

  async findById(id: string, connection?: PoolConnection): Promise<Vendor | null> {
    const query = "SELECT * FROM vendors WHERE id = ?";
    const [rows] = await (connection || this.pool).execute<RowDataPacket[]>(query, [id]);
    return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
  }

  async findByIdForUpdate(id: string, connection: PoolConnection): Promise<Vendor | null> {
    const [rows] = await connection.execute<RowDataPacket[]>("SELECT * FROM vendors WHERE id = ? FOR UPDATE", [id]);
    return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
  }

  async findByIds(ids: string[]): Promise<Vendor[]> {
    if (!ids || ids.length === 0) return [];
    const query = `SELECT * FROM vendors WHERE id IN (?)`;
    const [rows] = await this.pool.query<RowDataPacket[]>(query, [ids]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async findByUserId(userId: string): Promise<Vendor | null> {
    const query = "SELECT * FROM vendors WHERE user_id = ?";
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [userId]);
    return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
  }

  // Callers (admin dashboard, customer apps) load the full list and page it themselves
  async findAll(limit: number, offset: number, approvalStatus?: VendorApprovalStatus): Promise<Vendor[]> {
    const [rows] = approvalStatus
      ? await this.pool.query<RowDataPacket[]>("SELECT * FROM vendors WHERE approval_status = ? ORDER BY created_at ASC", [approvalStatus])
      : await this.pool.query<RowDataPacket[]>("SELECT * FROM vendors ORDER BY created_at ASC");
    return rows.map((row) => this.mapToEntity(row));
  }

  async countAll(): Promise<number> {
    const [rows] = await this.pool.query<RowDataPacket[]>("SELECT COUNT(*) as count FROM vendors");
    return rows[0].count;
  }

  async findByStatus(status: string): Promise<Vendor[]> {
    const query = "SELECT * FROM vendors WHERE status = ?";
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [status]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async update(id: string, data: Partial<Vendor>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.shopName) {
      fields.push("shop_name = ?");
      values.push(data.shopName);
    }
    if (data.shopDescription) {
      fields.push("shop_description = ?");
      values.push(data.shopDescription);
    }
    if (data.phone) {
      fields.push("phone = ?");
      values.push(data.phone);
    }
    if (data.address) {
      fields.push("address = ?");
      values.push(data.address);
    }
    if (data.latitude) {
      fields.push("latitude = ?");
      values.push(data.latitude);
    }
    if (data.longitude) {
      fields.push("longitude = ?");
      values.push(data.longitude);
    }
    if (data.storeImage) {
      fields.push("store_image = ?");
      values.push(data.storeImage);
    }
    if (data.type) {
      fields.push("type = ?");
      values.push(data.type);
    }

    if (fields.length === 0) return;

    values.push(id);
    const query = `UPDATE vendors SET ${fields.join(", ")} WHERE id = ?`;
    await this.pool.execute(query, values);
  }

  async updateStatus(id: string, status: string, connection?: PoolConnection): Promise<void> {
    const query = "UPDATE vendors SET status = ? WHERE id = ?";
    await (connection || this.pool).execute(query, [status, id]);
  }

  async resubmitRegistration(id: string, f: VendorRegistrationFields, connection: PoolConnection): Promise<void> {
    await connection.execute(
      `UPDATE vendors SET
         shop_name = ?, shop_description = ?, owner_name = ?, phone = ?, address = ?, latitude = ?, longitude = ?, type = ?,
         owner_national_id_url = ?, commercial_register_url = ?, tax_card_url = ?,
         approval_status = 'PENDING_REVIEW', submitted_at = NOW()
       WHERE id = ?`,
      [
        f.shopName,
        f.shopDescription ?? null,
        f.ownerName,
        f.phone,
        f.address,
        f.latitude,
        f.longitude,
        f.type,
        f.ownerNationalIdUrl,
        f.commercialRegisterUrl,
        f.taxCardUrl,
        id,
      ],
    );
  }

  async setApproval(id: string, status: VendorApprovalStatus, note: string | null, connection: PoolConnection): Promise<void> {
    await connection.execute("UPDATE vendors SET approval_status = ?, review_note = ?, reviewed_at = NOW() WHERE id = ?", [status, note, id]);
  }

  async addApprovalHistory(entry: VendorApprovalHistoryEntry, connection: PoolConnection): Promise<void> {
    await connection.execute(
      "INSERT INTO vendor_approval_history (id, vendor_id, approval_status, note, actor_user_id) VALUES (?, ?, ?, ?, ?)",
      [entry.id, entry.vendorId, entry.approvalStatus, entry.note, entry.actorUserId],
    );
  }

  async findApprovalHistory(vendorId: string): Promise<VendorApprovalHistoryEntry[]> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      "SELECT * FROM vendor_approval_history WHERE vendor_id = ? ORDER BY created_at DESC, id",
      [vendorId],
    );
    return rows.map((row) => ({
      id: row.id,
      vendorId: row.vendor_id,
      approvalStatus: row.approval_status,
      note: row.note,
      actorUserId: row.actor_user_id,
      createdAt: row.created_at,
    }));
  }

  async updateRating(id: string, averageRating: number, totalRatings: number): Promise<void> {
    const query = "UPDATE vendors SET average_rating = ?, total_ratings = ? WHERE id = ?";
    await this.pool.execute(query, [averageRating, totalRatings, id]);
  }

  private mapToEntity(row: any): Vendor {
    return {
      id: row.id,
      userId: row.user_id,
      shopName: row.shop_name,
      shopDescription: row.shop_description,
      phone: row.phone,
      address: row.address,
      latitude: row.latitude,
      longitude: row.longitude,
      storeImage: row.store_image,
      type: row.type,
      status: row.status,
      averageRating: row.average_rating ? parseFloat(row.average_rating) : 0,
      totalRatings: row.total_ratings || 0,
      isActive: row.is_active,
      approvalStatus: row.approval_status,
      ownerName: row.owner_name,
      ownerNationalIdUrl: row.owner_national_id_url,
      commercialRegisterUrl: row.commercial_register_url,
      taxCardUrl: row.tax_card_url,
      reviewNote: row.review_note,
      submittedAt: row.submitted_at,
      reviewedAt: row.reviewed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

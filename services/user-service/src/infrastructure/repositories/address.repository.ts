import { Pool, RowDataPacket } from "mysql2/promise";
import { Address } from "../../core/entities/address.entity";
import { IAddressRepository } from "../../core/interfaces/address.repository";
import { Database } from "@city-market/shared/node";

export class AddressRepository implements IAddressRepository {
  private pool: Pool;

  constructor(private db: Database) {
    this.pool = this.db.getPool();
  }

  async create(address: Address): Promise<Address> {
    const query = `
      INSERT INTO addresses (id, customer_id, label, address, latitude, longitude, is_default)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await this.pool.execute(query, [
      address.id,
      address.customerId,
      address.label || null,
      address.address,
      address.latitude || null,
      address.longitude || null,
      address.isDefault,
    ]);
    return address;
  }

  async findById(id: string): Promise<Address | null> {
    const query = "SELECT * FROM addresses WHERE id = ?";
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [id]);
    return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
  }

  async findByCustomer(customerId: string): Promise<Address[]> {
    const query = "SELECT * FROM addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC";
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [customerId]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async update(id: string, data: Partial<Address>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.label) {
      fields.push("label = ?");
      values.push(data.label);
    }
    if (data.address) {
      fields.push("address = ?");
      values.push(data.address);
    }
    if (data.isDefault) {
      fields.push("is_default = ?");
      values.push(data.isDefault);
    }

    if (fields.length === 0) return;

    values.push(id);
    const query = `UPDATE addresses SET ${fields.join(", ")} WHERE id = ?`;
    await this.pool.execute(query, values);
  }

  async delete(id: string): Promise<void> {
    const query = "DELETE FROM addresses WHERE id = ?";
    await this.pool.execute(query, [id]);
  }

  async clearDefaultForCustomer(customerId: string): Promise<void> {
    const query = "UPDATE addresses SET is_default = FALSE WHERE customer_id = ?";
    await this.pool.execute(query, [customerId]);
  }

  private mapToEntity(row: any): Address {
    return {
      id: row.id,
      customerId: row.customer_id,
      label: row.label,
      address: row.address,
      latitude: row.latitude,
      longitude: row.longitude,
      isDefault: row.is_default,
      createdAt: row.created_at,
    };
  }
}

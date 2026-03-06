import { Pool, RowDataPacket } from "mysql2/promise";
import { Customer } from "../../core/entities/customer.entity";
import { ICustomerRepository } from "../../core/interfaces/customer.repository";
import { Database } from "@city-market/shared/node";

export class CustomerRepository implements ICustomerRepository {
  private pool: Pool;

  constructor(private db: Database) {
    this.pool = this.db.getPool();
  }

  async create(customer: Customer): Promise<Customer> {
    const query = "INSERT INTO customers (id, user_id, full_name, phone) VALUES (?, ?, ?, ?)";
    await this.pool.execute(query, [customer.id, customer.userId, customer.fullName, customer.phone || null]);
    return customer;
  }

  async findById(id: string): Promise<Customer | null> {
    const query = "SELECT * FROM customers WHERE id = ?";
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [id]);
    return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
  }

  async findByUserId(userId: string): Promise<Customer | null> {
    const query = "SELECT * FROM customers WHERE user_id = ?";
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [userId]);
    return rows.length > 0 ? this.mapToEntity(rows[0]) : null;
  }

  async findByIds(ids: string[]): Promise<Customer[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => "?").join(", ");
    // Search by BOTH id and user_id to handle both internal and external (auth) IDs
    const query = `SELECT * FROM customers WHERE id IN (${placeholders}) OR user_id IN (${placeholders})`;
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [...ids, ...ids]);
    return rows.map(row => this.mapToEntity(row));
  }

  async update(id: string, data: Partial<Customer>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.fullName) {
      fields.push("full_name = ?");
      values.push(data.fullName);
    }
    if (data.phone !== undefined) {
      fields.push("phone = ?");
      values.push(data.phone);
    }

    if (fields.length === 0) return;

    values.push(id);
    const query = `UPDATE customers SET ${fields.join(", ")} WHERE id = ?`;
    await this.pool.execute(query, values);
  }

  private mapToEntity(row: any): Customer {
    return {
      id: row.id,
      userId: row.user_id,
      fullName: row.full_name,
      phone: row.phone,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

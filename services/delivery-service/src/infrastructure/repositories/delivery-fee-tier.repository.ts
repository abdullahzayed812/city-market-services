import { Database } from "@city-market/shared/node";
import { DeliveryFeeTier } from "../../core/entities/delivery-fee-tier.entity";
import { IDeliveryFeeTierRepository } from "../../core/interfaces/delivery-fee-tier.repository";

export class DeliveryFeeTierRepository implements IDeliveryFeeTierRepository {
  constructor(private db: Database) {}

  private mapToEntity(row: any): DeliveryFeeTier {
    return {
      id: row.id,
      minAmount: Number(row.min_amount),
      maxAmount: row.max_amount !== null ? Number(row.max_amount) : null,
      courierPercentage: Number(row.courier_percentage),
      officePercentage: Number(row.office_percentage),
      platformPercentage: Number(row.platform_percentage),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findAll(): Promise<DeliveryFeeTier[]> {
    const [rows]: any = await this.db.getPool().execute(`SELECT * FROM delivery_fee_tiers ORDER BY min_amount ASC`);
    return rows.map(this.mapToEntity);
  }

  async findById(id: string): Promise<DeliveryFeeTier | null> {
    const [rows]: any = await this.db.getPool().execute(`SELECT * FROM delivery_fee_tiers WHERE id = ?`, [id]);
    return rows.length ? this.mapToEntity(rows[0]) : null;
  }

  async findByAmount(amount: number): Promise<DeliveryFeeTier | null> {
    const [rows]: any = await this.db.getPool().execute(
      `SELECT * FROM delivery_fee_tiers
       WHERE min_amount <= ? AND (max_amount IS NULL OR max_amount > ?)
       ORDER BY min_amount DESC LIMIT 1`,
      [amount, amount],
    );
    return rows.length ? this.mapToEntity(rows[0]) : null;
  }

  async create(tier: DeliveryFeeTier): Promise<DeliveryFeeTier> {
    await this.db.getPool().execute(
      `INSERT INTO delivery_fee_tiers (id, min_amount, max_amount, courier_percentage, office_percentage, platform_percentage)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tier.id, tier.minAmount, tier.maxAmount, tier.courierPercentage, tier.officePercentage, tier.platformPercentage],
    );
    return tier;
  }

  async update(id: string, data: Partial<DeliveryFeeTier>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.minAmount) {
      fields.push("min_amount = ?");
      values.push(data.minAmount);
    }
    if (data.maxAmount) {
      fields.push("max_amount = ?");
      values.push(data.maxAmount);
    }
    if (data.courierPercentage) {
      fields.push("courier_percentage = ?");
      values.push(data.courierPercentage);
    }
    if (data.officePercentage) {
      fields.push("office_percentage = ?");
      values.push(data.officePercentage);
    }
    if (data.platformPercentage) {
      fields.push("platform_percentage = ?");
      values.push(data.platformPercentage);
    }

    if (!fields.length) return;
    values.push(id);
    await this.db.getPool().execute(`UPDATE delivery_fee_tiers SET ${fields.join(", ")} WHERE id = ?`, values);
  }

  async delete(id: string): Promise<void> {
    await this.db.getPool().execute(`DELETE FROM delivery_fee_tiers WHERE id = ?`, [id]);
  }
}

import { Pool, RowDataPacket } from "mysql2/promise";
import { WorkingHours } from "../../core/entities/working-hours.entity";
import { IWorkingHoursRepository } from "../../core/interfaces/working-hours.repository";
import { Database } from "@city-market/shared/node";

export class WorkingHoursRepository implements IWorkingHoursRepository {
  private pool: Pool;

  constructor(private db: Database) {
    this.pool = this.db.getPool();
  }

  async create(workingHours: WorkingHours): Promise<WorkingHours> {
    const query = `
      INSERT INTO working_hours (id, vendor_id, day_of_week, open_time, close_time, is_open)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    await this.pool.execute(query, [
      workingHours.id,
      workingHours.vendorId,
      workingHours.dayOfWeek,
      workingHours.openTime,
      workingHours.closeTime,
      workingHours.isOpen,
    ]);
    return workingHours;
  }

  async findByVendorId(vendorId: string): Promise<WorkingHours[]> {
    const query = "SELECT * FROM working_hours WHERE vendor_id = ? ORDER BY day_of_week";
    const [rows] = await this.pool.execute<RowDataPacket[]>(query, [vendorId]);
    return rows.map((row) => this.mapToEntity(row));
  }

  async upsert(workingHours: WorkingHours): Promise<void> {
    const query = `
      INSERT INTO working_hours (id, vendor_id, day_of_week, open_time, close_time, is_open)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        open_time = VALUES(open_time),
        close_time = VALUES(close_time),
        is_open = VALUES(is_open)
    `;
    await this.pool.execute(query, [
      workingHours.id,
      workingHours.vendorId,
      workingHours.dayOfWeek,
      workingHours.openTime,
      workingHours.closeTime,
      workingHours.isOpen,
    ]);
  }

  async deleteByVendorAndDay(vendorId: string, dayOfWeek: number): Promise<void> {
    const query = "DELETE FROM working_hours WHERE vendor_id = ? AND day_of_week = ?";
    await this.pool.execute(query, [vendorId, dayOfWeek]);
  }

  private mapToEntity(row: any): WorkingHours {
    return {
      id: row.id,
      vendorId: row.vendor_id,
      dayOfWeek: row.day_of_week,
      openTime: row.open_time,
      closeTime: row.close_time,
      isOpen: row.is_open,
    };
  }
}

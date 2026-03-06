import { PoolConnection } from "mysql2/promise";
import { Database } from "@city-market/shared/node";
import { IVendorRatingSummaryRepository } from "../../../core/interfaces/IVendorRatingSummaryRepository";
import { VendorRatingSummary } from "../../../core/entities/Rating";

export class VendorRatingSummaryRepository implements IVendorRatingSummaryRepository {
    constructor(private db: Database) { }

    async findByVendorId(vendorId: string, connection?: PoolConnection): Promise<VendorRatingSummary | null> {
        const sql = "SELECT * FROM vendor_rating_summary WHERE vendor_id = ?";
        const [rows]: any = connection
            ? await connection.execute(sql, [vendorId])
            : await this.db.getPool().execute(sql, [vendorId]);

        if (rows.length === 0) return null;
        return this.mapToEntity(rows[0]);
    }

    async findByVendorIdWithLock(vendorId: string, connection: PoolConnection): Promise<VendorRatingSummary | null> {
        const sql = "SELECT * FROM vendor_rating_summary WHERE vendor_id = ? FOR UPDATE";
        const [rows]: any = await connection.execute(sql, [vendorId]);
        if (rows.length === 0) return null;
        return this.mapToEntity(rows[0]);
    }

    async create(summary: VendorRatingSummary, connection?: PoolConnection): Promise<void> {
        const sql = "INSERT INTO vendor_rating_summary (vendor_id, total_ratings, total_stars, average_rating) VALUES (?, ?, ?, ?)";
        const values = [summary.vendorId, summary.totalRatings, summary.totalStars, summary.averageRating];

        if (connection) {
            await connection.execute(sql, values);
        } else {
            await this.db.getPool().execute(sql, values);
        }
    }

    async update(summary: VendorRatingSummary, connection?: PoolConnection): Promise<void> {
        const sql = "UPDATE vendor_rating_summary SET total_ratings = ?, total_stars = ?, average_rating = ? WHERE vendor_id = ?";
        const values = [summary.totalRatings, summary.totalStars, summary.averageRating, summary.vendorId];

        if (connection) {
            await connection.execute(sql, values);
        } else {
            await this.db.getPool().execute(sql, values);
        }
    }

    private mapToEntity(row: any): VendorRatingSummary {
        return {
            vendorId: row.vendor_id,
            totalRatings: row.total_ratings,
            totalStars: row.total_stars,
            averageRating: Number(row.average_rating)
        };
    }
}

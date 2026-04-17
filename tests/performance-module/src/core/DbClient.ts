import mysql, { Pool } from "mysql2/promise";

export class DbClient {
    private pool: Pool;

    constructor() {
        this.pool = mysql.createPool({
            host: process.env.DB_HOST || "localhost",
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER || "abdo",
            password: process.env.DB_PASSWORD || "password",
            database: "catalog_db",
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
        });
    }

    async getVendorProducts(vendorId: string, limit: number = 5): Promise<any[]> {
        const [rows]: any = await this.pool.query(
            `SELECT vp.id, vp.price, gp.measurement_type 
       FROM vendor_products vp 
       JOIN global_products gp ON vp.global_product_id = gp.id 
       WHERE vp.vendor_id = ? AND vp.is_available = TRUE AND vp.deleted_at IS NULL LIMIT ?`,
            [vendorId, limit],
        );
        return rows;
    }

    async getRandomProducts(limit: number = 20): Promise<any[]> {
        const [rows]: any = await this.pool.query(
            `SELECT vp.id, vp.vendor_id, vp.price, gp.measurement_type 
       FROM vendor_products vp 
       JOIN global_products gp ON vp.global_product_id = gp.id 
       WHERE vp.is_available = TRUE AND vp.deleted_at IS NULL ORDER BY RAND() LIMIT ?`,
            [limit],
        );
        return rows;
    }

    async close() {
        await this.pool.end();
    }
}

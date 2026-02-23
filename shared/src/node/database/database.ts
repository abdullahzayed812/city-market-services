import * as mysql from "mysql2/promise";
import { PoolConnection } from "mysql2/promise"; // Import PoolConnection for type hinting

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  connectionLimit?: number;
}

export interface IDatabase {
  getPool(): mysql.Pool;
  close(): Promise<void>;
  beginTransaction(): Promise<PoolConnection>; // New method
  commit(connection: PoolConnection): Promise<void>; // New method
  rollback(connection: PoolConnection): Promise<void>; // New method
}

export class Database implements IDatabase {
  private static instance: Database;
  private pool: mysql.Pool;

  constructor(config: DatabaseConfig) {
    this.pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      waitForConnections: true,
      connectionLimit: config.connectionLimit || parseInt(process.env.DB_CONNECTION_LIMIT || "50", 10),
      queueLimit: 0,
    });
  }

  public static getInstance(config?: DatabaseConfig): Database {
    if (!Database.instance) {
      if (!config) {
        throw new Error("Database not initialized. Call getInstance with config first.");
      }
      Database.instance = new Database(config);
    }
    return Database.instance;
  }

  public getPool(): mysql.Pool {
    return this.pool;
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }

  // New transaction methods
  public async beginTransaction(): Promise<PoolConnection> {
    const connection = await this.pool.getConnection();
    await connection.beginTransaction();
    return connection;
  }

  public async commit(connection: PoolConnection): Promise<void> {
    await connection.commit();
    connection.release(); // Release the connection back to the pool
  }

  public async rollback(connection: PoolConnection): Promise<void> {
    await connection.rollback();
    connection.release(); // Release the connection back to the pool
  }
}

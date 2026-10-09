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
  withTransaction<T>(fn: (connection: PoolConnection) => Promise<T>, maxRetries?: number): Promise<T>;
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
      // ~10 services share one MySQL (max_connections 151 by default), so each pool
      // must stay small: 10 x 10 = 100 leaves headroom for migrations/tools.
      // Requests beyond the limit queue instead of failing with "Too many connections".
      connectionLimit: config.connectionLimit || parseInt(process.env.DB_CONNECTION_LIMIT || "10", 10),
      // Release connections opened during a burst instead of holding them forever.
      maxIdle: parseInt(process.env.DB_MAX_IDLE || "2", 10),
      idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT_MS || "30000", 10),
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

  /**
   * Executes a function within a transaction with automatic retry on deadlocks.
   */
  public async withTransaction<T>(
    fn: (connection: PoolConnection) => Promise<T>,
    maxRetries: number = 3,
  ): Promise<T> {
    let lastError: any;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const connection = await this.beginTransaction();
      try {
        const result = await fn(connection);
        await this.commit(connection);
        return result;
      } catch (error: any) {
        await this.rollback(connection);
        lastError = error;

        // Check for MySQL Deadlock error (1213)
        const isDeadlock = error.code === "ER_LOCK_DEADLOCK" || error.errno === 1213;
        if (isDeadlock && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 100; // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }
}

import { Database } from "@city-market/shared/node";
import * as fs from "fs";
import * as path from "path";
import { config } from "../../config/env";

const initDb = async () => {
  const db = Database.getInstance({
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
  });
  const connection = db.getPool();

  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.dbName}\`;`);
    await connection.query(`USE \`${config.dbName}\`;`);

    const schemaPath = path.join(__dirname, "schema.sql");
    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, "utf8");
      const statements = schema
        .split(/;\s*$/m)
        .map((s) => s.trim())
        .filter(Boolean);

      for (const stmt of statements) {
        await connection.query(stmt);
      }
      console.log("Database initialized successfully with schema.sql");
    } else {
      console.log("Database initialized (no schema.sql found)");
    }
  } catch (error) {
    console.error("Error initializing database:", error);
    process.exit(1);
  } finally {
    await db.close();
  }
};

initDb().then(() => process.exit(0));

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
    const schema = fs.readFileSync(schemaPath, "utf8");

    const statements = schema
      .split(/;\s*$/m) // split on semicolon line endings
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      await connection.query(stmt);
    }

    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  } finally {
    await db.close();
  }
};

initDb()
  .then(() => {
    console.log("Initialization script finished.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Initialization script failed:", err);
    process.exit(1);
  });

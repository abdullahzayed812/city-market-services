import { Database } from "@city-market/shared/node";
import { config } from "../../config/env";
import fs from "fs";
import path from "path";

const resetDb = async () => {
  const db = Database.getInstance({
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
  });
  const connection = db.getPool();

  try {
    await connection.query(`DROP DATABASE IF EXISTS \`${config.dbName}\`;`);
    console.log("Database dropped");

    await connection.query(`CREATE DATABASE \`${config.dbName}\`;`);
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

    // await connection.query(schema);

    console.log("Database reset and re-initialized successfully");
  } catch (error) {
    console.error("Error resetting database:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

resetDb();

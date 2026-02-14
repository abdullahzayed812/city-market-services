import { Database } from "@city-market/shared/node";
import { config } from "../../config/env";

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

    // Re-initialize
    // We can import initDb here or just run the commands.
    // For simplicity and decoupling, let's just re-run the init logic or call the script via shell if needed.
    // But since we want this to be standalone TS, let's just recreate the DB and call it a day,
    // or better, let the user run init-db after reset.
    // However, the requirement says "reset-db.ts -> drops and recreates the schema".

    await connection.query(`CREATE DATABASE \`${config.dbName}\`;`);
    await connection.query(`USE \`${config.dbName}\`;`);

    // We could read schema.sql again here, but to avoid code duplication,
    // we should probably just rely on the user running init-db, OR we can import the logic.
    // Given the constraints, I'll just drop and create the DB, and let the user run init-db
    // OR I can execute the schema here too. Let's execute the schema here too for convenience.

    const fs = require("fs");
    const path = require("path");
    const schemaPath = path.join(__dirname, "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");

    const statements = schema
      .split(/;\s*$/m) // split on semicolon line endings
      .map((s: string) => s.trim())
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

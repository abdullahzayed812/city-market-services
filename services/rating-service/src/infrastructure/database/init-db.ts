import { Database } from "@city-market/shared/node";
import { config } from "../../config/env";
import fs from "fs";
import path from "path";

const initDb = async () => {
  const db = new Database({
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: "mysql", // Connect to mysql system DB to create the target DB if not exists
  });

  try {
    await db.getPool().execute(`CREATE DATABASE IF NOT EXISTS ${config.dbName}`);
    console.log(`Database ${config.dbName} ensured.`);
    await db.close();

    const targetDb = new Database({
      host: config.dbHost,
      port: config.dbPort,
      user: config.dbUser,
      password: config.dbPassword,
      database: config.dbName,
    });

    const schemaPath = path.join(__dirname, "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");

    // Split by semicolon and filter out empty statements
    const statements = schema
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      await targetDb.getPool().execute(statement);
    }

    console.log("Schema initialized successfully.");
    await targetDb.close();
  } catch (error) {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  }
};

initDb();

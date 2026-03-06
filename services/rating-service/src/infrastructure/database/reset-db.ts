import { Database } from "@city-market/shared/node";
import { config } from "../../config/env";
import fs from "fs";
import path from "path";

const resetDb = async () => {
  const db = new Database({
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: "mysql", // Connect to mysql system DB to drop/create target DB
  });

  try {
    await db.getPool().execute(`DROP DATABASE IF EXISTS \`${config.dbName}\``);
    console.log(`Database ${config.dbName} dropped.`);

    await db.getPool().execute(`CREATE DATABASE \`${config.dbName}\``);
    console.log(`Database ${config.dbName} created.`);
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
      .split(/;\s*$/m) // split on semicolon line endings
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      await targetDb.getPool().execute(statement);
    }

    console.log("Schema initialized successfully.");
    await targetDb.close();
  } catch (error) {
    console.error("Failed to reset database:", error);
    process.exit(1);
  }
};

resetDb();

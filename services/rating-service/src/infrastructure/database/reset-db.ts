import { Database } from "@city-market/shared/node";
import { config } from "../../config/env";
import * as fs from "fs";
import * as path from "path";

const resetDb = async () => {
  const db = new Database({
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: "mysql", // Connect to mysql system DB to drop/create target DB
  });

  let targetDb: Database | undefined;

  try {
    await db.getPool().execute(`DROP DATABASE IF EXISTS \`${config.dbName}\``);
    console.log(`Database ${config.dbName} dropped.`);

    await db.getPool().execute(`CREATE DATABASE \`${config.dbName}\``);
    console.log(`Database ${config.dbName} created.`);

    targetDb = new Database({
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
  } catch (error) {
    console.error("Failed to reset database:", error);
    throw error;
  } finally {
    await db.close();
    if (targetDb) {
      await targetDb.close();
    }
  }
};

resetDb()
  .then(() => {
    console.log("Reset script finished.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Reset script failed:", err);
    process.exit(1);
  });

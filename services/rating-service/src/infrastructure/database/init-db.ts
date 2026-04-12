import { Database } from "@city-market/shared/node";
import { config } from "../../config/env";
import * as fs from "fs";
import * as path from "path";

const initDb = async () => {
  const db = new Database({
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: "mysql", // Connect to mysql system DB to create the target DB if not exists
  });

  let targetDb: Database | undefined;

  try {
    await db.getPool().execute(`CREATE DATABASE IF NOT EXISTS \`${config.dbName}\``);
    console.log(`Database ${config.dbName} ensured.`);
    await db.close();

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
    console.error("Failed to initialize database:", error);
    throw error;
  } finally {
    await db.close();
    if (targetDb) {
      await targetDb.close();
    }
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

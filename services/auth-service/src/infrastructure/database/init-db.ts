import { Database } from "@city-market/shared/node";
import fs from "fs";
import path from "path";
import { config } from "../../config/env";

const initDb = async () => {
  // For init scripts, we might still want a direct connection or use the singleton.
  // However, the singleton is designed for the app.
  // For scripts, we can use the singleton but we need to initialize it.
  // Or we can keep using mysql.createConnection if it's a standalone script.
  // The requirement is "Refactor the database connection logic... replacing it with a Database class...".
  // Usually scripts are standalone. But let's try to use the shared class if possible to be consistent.
  // But Database class uses createPool. init-db often needs createConnection for multiple statements or root access.
  // Actually, createPool can also handle queries.
  // Let's stick to the plan: "Update to use Database.getInstance(config).getPool()".

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

    // await connection.query(schema);
    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

initDb();

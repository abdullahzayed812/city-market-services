import type { Knex } from "knex";
import { config } from "./src/config/env";

const knexConfig: { [key: string]: Knex.Config } = {
  development: {
    client: "mysql2",
    connection: {
      host: config.dbHost,
      port: config.dbPort,
      user: config.dbUser,
      password: config.dbPassword,
      database: config.dbName,
    },
    migrations: {
      directory: "./src/infrastructure/database/migrations",
      extension: "ts",
    },
  },
  production: {
    client: "mysql2",
    connection: {
      host: config.dbHost,
      port: config.dbPort,
      user: config.dbUser,
      password: config.dbPassword,
      database: config.dbName,
    },
    migrations: {
      directory: "./src/infrastructure/database/migrations",
    },
  },
};

export default knexConfig;

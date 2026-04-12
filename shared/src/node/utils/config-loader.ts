import { Logger } from "./logger.js";
import { config as dotenvConfig } from "dotenv";

export interface ConfigSchema {
  [key: string]: {
    env: string;
    default?: any;
    required?: boolean;
    sensitive?: boolean;
  };
}

export class ConfigLoader {
  static load<T>(schema: ConfigSchema): T {
    // 1. Load the .env file quietly
    dotenvConfig({ quiet: true } as any);

    const config: any = {};
    const missingVars: string[] = [];

    for (const [key, details] of Object.entries(schema)) {
      const value = process.env[details.env];

      if (value === undefined || value === "") {
        if (details.required) {
          missingVars.push(details.env);
        } else {
          config[key] = details.default;
        }
      } else {
        // Simple type conversion
        if (typeof details.default === "number") {
          config[key] = Number(value);
        } else if (typeof details.default === "boolean") {
          config[key] = value === "true";
        } else {
          config[key] = value;
        }
      }

      // Production Safety: Check for default secrets in production
      if (
        process.env.NODE_ENV === "production" &&
        details.sensitive &&
        config[key] === details.default &&
        details.default !== undefined
      ) {
        Logger.error(`CRITICAL: Sensitive variable ${details.env} is using a default value in production!`);
        process.exit(1);
      }
    }

    if (missingVars.length > 0) {
      Logger.error(`CRITICAL: Missing required environment variables: ${missingVars.join(", ")}`);
      process.exit(1);
    }

    return config as T;
  }
}

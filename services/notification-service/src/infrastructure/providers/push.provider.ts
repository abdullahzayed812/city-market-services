import * as admin from "firebase-admin";
import { Logger } from "@city-market/shared/node";
import { config } from "../../config/env";
import path from "path";
import fs from "fs";

export interface PushMessage {
  token: string;
  title: string;
  body: string;
  data?: any;
}

export class PushNotificationProvider {
  private initialized = false;

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (admin.apps.length > 0) {
        this.initialized = true;
        return;
      }

      let credential: admin.ServiceAccount | string | undefined;

      // 1. Check for stringified JSON or path in environment variable
      const saJson = config.firebase.serviceAccountJson;
      if (saJson) {
        if (saJson.trim().startsWith('{')) {
          try {
            credential = JSON.parse(saJson);
            Logger.info("Firebase: Using credentials from FIREBASE_SERVICE_ACCOUNT_JSON (parsed string)");
          } catch (e) {
            Logger.error("Firebase: Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON string", e);
          }
        } else {
          // It might be a path
          const fullPath = path.resolve(saJson);
          if (fs.existsSync(fullPath)) {
            credential = fullPath;
            Logger.info(`Firebase: Using credentials from path in FIREBASE_SERVICE_ACCOUNT_JSON: ${fullPath}`);
          } else {
            Logger.warn(`Firebase: FIREBASE_SERVICE_ACCOUNT_JSON is not JSON and file path does not exist: ${saJson}`);
          }
        }
      } 
      
      // 2. Check for path in environment variable (dedicated path var)
      else if (config.firebase.serviceAccountPath) {
        if (fs.existsSync(config.firebase.serviceAccountPath)) {
          credential = config.firebase.serviceAccountPath;
          Logger.info(`Firebase: Using credentials from path: ${config.firebase.serviceAccountPath}`);
        } else {
          Logger.warn(`Firebase: Path provided in FIREBASE_SERVICE_ACCOUNT_PATH does not exist: ${config.firebase.serviceAccountPath}`);
        }
      }

      // 3. Check for default file location in config folder
      if (!credential) {
        const defaultPath = path.join(__dirname, "../../config/firebase-service-account.json");
        if (fs.existsSync(defaultPath)) {
          credential = defaultPath;
          Logger.info("Firebase: Using default credentials file at src/config/firebase-service-account.json");
        }
      }

      if (credential) {
        admin.initializeApp({
          credential: typeof credential === 'string' 
            ? admin.credential.cert(credential) 
            : admin.credential.cert(credential),
        });
        this.initialized = true;
        Logger.info("Firebase Admin successfully initialized");
      } else {
        Logger.warn("Firebase: No credentials found (checked ENV JSON, ENV Path, and default file). Notifications will be LOGGED ONLY.");
      }
    } catch (error) {
      Logger.error("Failed to initialize Firebase Admin", error);
    }
  }

  async send(message: PushMessage): Promise<void> {
    if (!this.initialized) {
      Logger.info(`[Push LOG Fallback] To: ${message.token} | Title: ${message.title} | Body: ${message.body}`);
      return;
    }

    try {
      await admin.messaging().send({
        token: message.token,
        notification: {
          title: message.title,
          body: message.body,
        },
        data: this.serializeData(message.data),
        android: {
          priority: 'high',
          notification: {
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true,
          },
        },
        apns: {
          payload: {
            aps: {
              contentAvailable: true,
              sound: 'default',
            },
          },
        },
      });
      Logger.info(`[Push Sent] Successfully delivered to ${message.token}`);
    } catch (error) {
      Logger.error(`[Push Failed] Error sending to ${message.token}`, error);
    }
  }

  async sendMulticast(tokens: string[], title: string, body: string, data?: any): Promise<void> {
    if (!this.initialized) {
      Logger.info(`[Push LOG Fallback] Multicast to ${tokens.length} devices | Title: ${title}`);
      return;
    }

    try {
      const response = await admin.messaging().sendEachForMulticast({
        tokens,
        notification: {
          title,
          body,
        },
        data: this.serializeData(data),
        android: {
          priority: 'high',
          notification: {
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true,
          },
        },
        apns: {
          payload: {
            aps: {
              contentAvailable: true,
              sound: 'default',
            },
          },
        },
      });
      
      Logger.info(`[Push Multicast] Sent. Success: ${response.successCount}, Failure: ${response.failureCount}`);
      
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            Logger.error(`[Push Multicast Error] Token ${tokens[idx]}:`, resp.error);
          }
        });
      }
    } catch (error) {
      Logger.error(`[Push Multicast Critical Failure]`, error);
    }
  }

  private serializeData(data?: any): { [key: string]: string } | undefined {
    if (!data) return undefined;
    const serialized: { [key: string]: string } = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        serialized[key] = typeof data[key] === 'string' ? data[key] : JSON.stringify(data[key]);
      }
    }
    return serialized;
  }
}

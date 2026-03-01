export const config = {
  port: process.env.PORT || 3008,
  dbHost: process.env.DB_HOST || "localhost",
  dbPort: parseInt(process.env.DB_PORT || "3306"),
  dbUser: process.env.DB_USER || "abdo",
  dbPassword: process.env.DB_PASSWORD || "password",
  dbName: process.env.DB_NAME || "notification_db",
  firebase: {
    // Can be a JSON string (starts with '{') or a file path (e.g. "./firebase.json")
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON, 
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
  },
};

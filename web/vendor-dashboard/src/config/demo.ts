// Demo accounts on the login screen (prefilled + one-tap list).
// Temporarily ON in every build, including production, at the owner's request.
// To limit it to development: export const DEMO_MODE = import.meta.env.DEV;
export const DEMO_MODE = true;

// Seed accounts from services/auth-service/src/infrastructure/database/seed-db.ts
export const DEMO_PASSWORD = "password123";
// Vendor accounts are listed on the login page itself (quick login).
export const DEMO_ACCOUNTS = [{ label: "سوبر ماركت مدينتي", email: "supermarket1@citymarket.com" }];

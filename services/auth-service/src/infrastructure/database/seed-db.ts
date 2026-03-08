import { SEED_DATA } from "@city-market/shared";
import { Database } from "@city-market/shared/node";
import bcrypt from "bcrypt";
import { config } from "../../config/env";

// Additional Vendor User IDs for cross-service consistency
const VENDOR_USER_IDS = {
  SANAQREH: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a30",
  AHMED_YEHIA: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a31",
  SABAWI: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a32",
  ABDULLAH_BUTCHER: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33",
  BEHEIRY_POULTRY: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a34",
  GHANEM_FISH: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a35",
  MUTAWAKKIL_FISH: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a36",
  ABU_YOUSSEF_FISH: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a37",
  BONDOQA: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a38",
  ASHRI: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a39",
  LOZINA: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a40",
  AL_BARAKA_BAKERY: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a41",
  ABU_OMAR: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a42",
  RAWAN: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a43",
  SHADY_LIBRARY: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44",
  AWLAD_RAGAB: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a45",
  MAZAARE_AL_KHEIR: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a46",
};

const seedDb = async () => {
  const db = Database.getInstance({
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
  });
  const connection = db.getPool();

  try {
    const passwordHash = await bcrypt.hash("password123", 10);

    const users = [
      {
        id: SEED_DATA.USERS.ADMIN,
        email: "admin@citymarket.com",
        password_hash: passwordHash,
        role: "ADMIN",
        is_active: true,
      },
      {
        id: SEED_DATA.USERS.CUSTOMER,
        email: "customer@citymarket.com",
        password_hash: passwordHash,
        role: "CUSTOMER",
        is_active: true,
      },
      // Fixed SEED_DATA Vendors
      { id: SEED_DATA.USERS.VENDOR1, email: "supermarket1@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: SEED_DATA.USERS.VENDOR2, email: "supermarket2@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: SEED_DATA.USERS.VENDOR3, email: "pharmacy@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: SEED_DATA.USERS.VENDOR4, email: "bakery@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: SEED_DATA.USERS.VENDOR5, email: "butcher@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: SEED_DATA.USERS.VENDOR6, email: "poultry@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: SEED_DATA.USERS.VENDOR7, email: "fish@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      
      // New Vendors
      { id: VENDOR_USER_IDS.SANAQREH, email: "sanaqreh@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: VENDOR_USER_IDS.AHMED_YEHIA, email: "ahmed_yehia@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: VENDOR_USER_IDS.SABAWI, email: "sabawi@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: VENDOR_USER_IDS.ABDULLAH_BUTCHER, email: "abdullah_butcher@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: VENDOR_USER_IDS.BEHEIRY_POULTRY, email: "beheiry_poultry@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: VENDOR_USER_IDS.GHANEM_FISH, email: "ghanem_fish@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: VENDOR_USER_IDS.MUTAWAKKIL_FISH, email: "mutawakkil_fish@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: VENDOR_USER_IDS.ABU_YOUSSEF_FISH, email: "abu_youssef_fish@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: VENDOR_USER_IDS.BONDOQA, email: "bondoqa@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: VENDOR_USER_IDS.ASHRI, email: "ashri@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: VENDOR_USER_IDS.LOZINA, email: "lozina@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: VENDOR_USER_IDS.AL_BARAKA_BAKERY, email: "al_baraka_bakery@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: VENDOR_USER_IDS.ABU_OMAR, email: "abu_omar@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: VENDOR_USER_IDS.RAWAN, email: "rawan@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: VENDOR_USER_IDS.SHADY_LIBRARY, email: "shady_library@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: VENDOR_USER_IDS.AWLAD_RAGAB, email: "awlad_ragab@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: VENDOR_USER_IDS.MAZAARE_AL_KHEIR, email: "mazaare_al_kheir@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },

      {
        id: SEED_DATA.USERS.COURIER,
        email: "courier@citymarket.com",
        password_hash: passwordHash,
        role: "COURIER",
        is_active: true,
      },
      {
        id: SEED_DATA.USERS.DELIVERY_MANAGER,
        email: "deliverymanager@citymarket.com",
        password_hash: passwordHash,
        role: "DELIVERY_MANAGER",
        is_active: true,
      },
    ];

    for (const user of users) {
      await connection.execute(
        "INSERT IGNORE INTO users (id, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)",
        [user.id, user.email, user.password_hash, user.role, user.is_active],
      );
    }

    console.log("Users seeded successfully");
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

seedDb();

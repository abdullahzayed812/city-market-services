import { SEED_DATA } from "@city-market/shared";
import { Database } from "@city-market/shared/node";
import bcrypt from "bcrypt";
import { config } from "../../config/env";

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
      {
        id: SEED_DATA.USERS.MADINATY_SUPERMARKET,
        email: "supermarket1@citymarket.com",
        password_hash: passwordHash,
        role: "VENDOR",
        is_active: true,
      },
      {
        id: SEED_DATA.USERS.AL_JAZIRA_SUPERMARKET,
        email: "supermarket2@citymarket.com",
        password_hash: passwordHash,
        role: "VENDOR",
        is_active: true,
      },
      {
        id: SEED_DATA.USERS.MOATAZ_PHARMACY,
        email: "pharmacy@citymarket.com",
        password_hash: passwordHash,
        role: "VENDOR",
        is_active: true,
      },
      {
        id: SEED_DATA.USERS.EL_MADINA_BAKERY,
        email: "bakery@citymarket.com",
        password_hash: passwordHash,
        role: "VENDOR",
        is_active: true,
      },
      {
        id: SEED_DATA.USERS.AL_RADWA_BUTCHER,
        email: "butcher@citymarket.com",
        password_hash: passwordHash,
        role: "VENDOR",
        is_active: true,
      },
      {
        id: SEED_DATA.USERS.AL_HAKEEM_POULTRY,
        email: "poultry@citymarket.com",
        password_hash: passwordHash,
        role: "VENDOR",
        is_active: true,
      },
      {
        id: SEED_DATA.USERS.AL_HAKEEM_FISH,
        email: "fish@citymarket.com",
        password_hash: passwordHash,
        role: "VENDOR",
        is_active: true,
      },

      // New Vendors
      { id: SEED_DATA.USERS.SANAQREH, email: "sanaqreh@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: SEED_DATA.USERS.AHMED_YEHIA, email: "ahmed_yehia@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: SEED_DATA.USERS.SABAWI, email: "sabawi@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: SEED_DATA.USERS.ABDULLAH_BUTCHER, email: "abdullah_butcher@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: SEED_DATA.USERS.BEHEIRY_POULTRY, email: "beheiry_poultry@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: SEED_DATA.USERS.GHANEM_FISH, email: "ghanem_fish@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: SEED_DATA.USERS.MUTAWAKKIL_FISH, email: "mutawakkil_fish@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: SEED_DATA.USERS.ABU_YOUSSEF_FISH, email: "abu_youssef_fish@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: SEED_DATA.USERS.BONDOQA, email: "bondoqa@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: SEED_DATA.USERS.ASHRI, email: "ashri@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: SEED_DATA.USERS.LOZINA, email: "lozina@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: SEED_DATA.USERS.AL_BARAKA_BAKERY, email: "al_baraka_bakery@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: SEED_DATA.USERS.ABU_OMAR, email: "abu_omar@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: SEED_DATA.USERS.RAWAN, email: "rawan@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: SEED_DATA.USERS.SHADY_LIBRARY, email: "shady_library@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: SEED_DATA.USERS.AWLAD_RAGAB, email: "awlad_ragab@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },
      { id: SEED_DATA.USERS.MAZAARE_AL_KHEIR, email: "mazaare_al_kheir@citymarket.com", password_hash: passwordHash, role: "VENDOR", is_active: true },

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
      {
        id: SEED_DATA.USERS.DELIVERY_MANAGER_2,
        email: "deliverymanager2@citymarket.com",
        password_hash: passwordHash,
        role: "DELIVERY_MANAGER",
        is_active: true,
      },
      {
        id: SEED_DATA.USERS.DELIVERY_MANAGER_3,
        email: "deliverymanager3@citymarket.com",
        password_hash: passwordHash,
        role: "DELIVERY_MANAGER",
        is_active: true,
      },
      { id: SEED_DATA.USERS.COURIER_SARA, email: "courier.sara@citymarket.com", password_hash: passwordHash, role: "COURIER", is_active: true },
      { id: SEED_DATA.USERS.COURIER_OMAR, email: "courier.omar@citymarket.com", password_hash: passwordHash, role: "COURIER", is_active: true },
      { id: SEED_DATA.USERS.COURIER_LAYLA, email: "courier.layla@citymarket.com", password_hash: passwordHash, role: "COURIER", is_active: true },
      { id: SEED_DATA.USERS.COURIER_KARIM, email: "courier.karim@citymarket.com", password_hash: passwordHash, role: "COURIER", is_active: true },
      { id: SEED_DATA.USERS.COURIER_NOUR, email: "courier.nour@citymarket.com", password_hash: passwordHash, role: "COURIER", is_active: true },
      { id: SEED_DATA.USERS.COURIER_HASSAN, email: "courier.hassan@citymarket.com", password_hash: passwordHash, role: "COURIER", is_active: true },
      { id: SEED_DATA.USERS.COURIER_DINA, email: "courier.dina@citymarket.com", password_hash: passwordHash, role: "COURIER", is_active: true },
      { id: SEED_DATA.USERS.COURIER_YASSER, email: "courier.yasser@citymarket.com", password_hash: passwordHash, role: "COURIER", is_active: true },
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
    throw error;
  } finally {
    await db.close();
  }
};

seedDb()
  .then(() => {
    console.log("Seeding script finished.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seeding script failed:", err);
    process.exit(1);
  });

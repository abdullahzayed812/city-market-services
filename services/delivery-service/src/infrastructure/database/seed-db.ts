import { Database, SEED_DATA, DeliveryStatus } from "@city-market/shared";
import { config } from "../../config/env";
import { randomUUID } from "crypto";

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
        const courierId = SEED_DATA.COURIERS.MIKE;
        const userId = SEED_DATA.USERS.COURIER;

        await connection.execute(
            "INSERT IGNORE INTO couriers (id, user_id, full_name, phone, vehicle_type, license_plate, is_available) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [courierId, userId, "Mike Courier", "+201222222222", "Motorcycle", "ABC-123", true]
        );

        const orderId = SEED_DATA.ORDERS.ORDER_1;

        await connection.execute(
            "INSERT IGNORE INTO deliveries (id, order_id, courier_id, status, pickup_address, delivery_address, pickup_latitude, pickup_longitude, delivery_latitude, delivery_longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [randomUUID(), orderId, courierId, DeliveryStatus.ASSIGNED, "456 Food St", "123 Main St", 30.9123, 29.6789, 30.9500, 29.7000]
        );

        console.log("Database seeded successfully");
    } catch (error) {
        console.error("Error seeding database:", error);
        process.exit(1);
    } finally {
        await connection.end();
    }
};

seedDb();

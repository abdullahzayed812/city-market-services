import { SEED_DATA } from "@city-market/shared";
import { Database } from "@city-market/shared/node";
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
        const orderId = SEED_DATA.ORDERS.ORDER_1;
        const customerId = SEED_DATA.CUSTOMERS.JOHN_DOE;
        const vendorId = SEED_DATA.VENDORS.BEST_BURGER;

        await connection.execute(
            "INSERT IGNORE INTO orders (id, customer_id, vendor_id, status, subtotal, delivery_fee, commission_amount, total_amount, delivery_address, delivery_latitude, delivery_longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [orderId, customerId, vendorId, "CREATED", 70.00, 10.00, 7.00, 80.00, "123 Main St", 30.9123, 29.6789]
        );

        await connection.execute(
            "INSERT IGNORE INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [randomUUID(), orderId, randomUUID(), "Cheeseburger", 1, 50.00, 50.00]
        );

        await connection.execute(
            "INSERT IGNORE INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [randomUUID(), orderId, randomUUID(), "Fries", 1, 20.00, 20.00]
        );

        await connection.execute(
            "INSERT IGNORE INTO order_status_history (id, order_id, status, notes) VALUES (?, ?, ?, ?)",
            [randomUUID(), orderId, "CREATED", "Order placed by customer"]
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

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
        const customerId = SEED_DATA.CUSTOMERS.JOHN_DOE;
        const userId = SEED_DATA.USERS.CUSTOMER;

        await connection.execute(
            "INSERT IGNORE INTO customers (id, user_id, full_name, phone) VALUES (?, ?, ?, ?)",
            [customerId, userId, "John Doe", "+201234567890"]
        );

        const addresses = [
            {
                id: randomUUID(),
                customer_id: customerId,
                label: "Home",
                address: "123 Main St, Borg El Arab",
                latitude: 30.9123,
                longitude: 29.6789,
                is_default: true
            },
            {
                id: randomUUID(),
                customer_id: customerId,
                label: "Work",
                address: "456 Tech Park, Alexandria",
                latitude: 31.2001,
                longitude: 29.9187,
                is_default: false
            },
            {
                id: randomUUID(),
                customer_id: customerId,
                label: "Gym",
                address: "789 Fitness Way, Smouha",
                latitude: 31.2156,
                longitude: 29.9497,
                is_default: false
            }
        ];

        for (const addr of addresses) {
            await connection.execute(
                "INSERT IGNORE INTO addresses (id, customer_id, label, address, latitude, longitude, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [addr.id, addr.customer_id, addr.label, addr.address, addr.latitude, addr.longitude, addr.is_default]
            );
        }

        console.log("Database seeded successfully");
    } catch (error) {
        console.error("Error seeding database:", error);
        process.exit(1);
    } finally {
        await connection.end();
    }
};

seedDb();

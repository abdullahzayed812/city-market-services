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
        const categories = [
            { id: SEED_DATA.CATEGORIES.FOOD, name: "Food", description: "Delicious food items" },
            { id: SEED_DATA.CATEGORIES.DRINKS, name: "Drinks", description: "Refreshing beverages" }
        ];

        for (const cat of categories) {
            await connection.execute(
                "INSERT IGNORE INTO categories (id, name, description) VALUES (?, ?, ?)",
                [cat.id, cat.name, cat.description]
            );
        }

        const products = [
            {
                id: randomUUID(),
                vendor_id: SEED_DATA.VENDORS.BEST_BURGER,
                category_id: SEED_DATA.CATEGORIES.FOOD,
                name: "Cheeseburger",
                description: "Juicy beef burger with cheese",
                price: 50.00,
                stock_quantity: 100,
                is_available: true
            },
            {
                id: randomUUID(),
                vendor_id: SEED_DATA.VENDORS.BEST_BURGER,
                category_id: SEED_DATA.CATEGORIES.FOOD,
                name: "Fries",
                description: "Crispy golden fries",
                price: 20.00,
                stock_quantity: 200,
                is_available: true
            },
            {
                id: randomUUID(),
                vendor_id: SEED_DATA.VENDORS.BEST_BURGER,
                category_id: SEED_DATA.CATEGORIES.DRINKS,
                name: "Cola",
                description: "Ice cold cola",
                price: 15.00,
                stock_quantity: 150,
                is_available: true
            },
            {
                id: randomUUID(),
                vendor_id: SEED_DATA.VENDORS.PIZZA_PALACE,
                category_id: SEED_DATA.CATEGORIES.FOOD,
                name: "Margherita Pizza",
                description: "Classic tomato and mozzarella",
                price: 80.00,
                stock_quantity: 50,
                is_available: true
            },
            {
                id: randomUUID(),
                vendor_id: SEED_DATA.VENDORS.PIZZA_PALACE,
                category_id: SEED_DATA.CATEGORIES.FOOD,
                name: "Pepperoni Pizza",
                description: "Spicy pepperoni and cheese",
                price: 95.00,
                stock_quantity: 40,
                is_available: true
            }
        ];

        for (const prod of products) {
            await connection.execute(
                "INSERT IGNORE INTO products (id, vendor_id, category_id, name, description, price, stock_quantity, is_available) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [prod.id, prod.vendor_id, prod.category_id, prod.name, prod.description, prod.price, prod.stock_quantity, prod.is_available]
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

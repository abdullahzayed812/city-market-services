import { PoolConnection } from "mysql2/promise";
import { GlobalProductSeed, VendorProductSeed } from "../factories/product.factory";

export class ProductSeeder {
  constructor(private connection: PoolConnection) {}

  async seedGlobalProducts(products: GlobalProductSeed[]): Promise<void> {
    if (products.length === 0) return;

    const query = `
      INSERT IGNORE INTO global_products 
      (id, name, description, global_category_id, measurement_type, weight_unit) 
      VALUES ?
    `;

    const values = products.map((p) => [
      p.id,
      p.name,
      p.description,
      p.global_category_id,
      p.measurement_type,
      p.weight_unit,
    ]);

    // Insert in batches of 1000 to avoid blocking the event loop for too long
    const batchSize = 1000;
    for (let i = 0; i < values.length; i += batchSize) {
      const batch = values.slice(i, i + batchSize);
      await this.connection.query(query, [batch]);
      console.log(`Inserted ${i + batch.length} / ${products.length} global products`);
    }
  }

  async seedVendorProducts(products: VendorProductSeed[]): Promise<void> {
    if (products.length === 0) return;

    const query = `
      INSERT IGNORE INTO vendor_products 
      (id, vendor_id, global_product_id, vendor_category_id, price, stock_quantity, stock_weight_grams, is_available) 
      VALUES ?
    `;

    const values = products.map((p) => [
      p.id,
      p.vendor_id,
      p.global_product_id,
      p.vendor_category_id,
      p.price,
      p.stock_quantity,
      p.stock_weight_grams,
      p.is_available,
    ]);

    const batchSize = 1000;
    for (let i = 0; i < values.length; i += batchSize) {
      const batch = values.slice(i, i + batchSize);
      await this.connection.query(query, [batch]);
      console.log(`Inserted ${i + batch.length} / ${products.length} vendor products`);
    }
  }

  logSummary(globalProducts: GlobalProductSeed[], vendorProducts: VendorProductSeed[], categories: string[]): void {
    console.log("\n--- Seeding Summary ---");
    console.log(`Global products : ${globalProducts.length}`);
    console.log(`Vendor listings : ${vendorProducts.length}`);
    console.log(`Categories      : ${categories.join(", ")}`);
    console.log("------------------------\n");
  }
}

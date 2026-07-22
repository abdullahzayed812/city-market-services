import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { randomUUID } from "crypto";
import Papa from "papaparse";
import { SEED_DATA, MeasurementType } from "@city-market/shared";
import { Database, Logger } from "@city-market/shared/node";
import { config } from "../../config/env";
import { GlobalProductRepository } from "../repositories/global-product.repository";
import { MediaClient } from "../http/media-client";
import { GlobalProduct } from "../../core/entities/global-product.entity";

/**
 * One-off seeder: imports product CSVs (name, description, image_url) from a folder tree into
 * the global catalog. Each top-level subfolder name maps to an existing Global Category — the
 * CSVs inside it (however many, whatever they're named) all import into that one category.
 *
 * Usage:
 *   npm run db:import-global-products                  # imports from ~/Downloads
 *   npm run db:import-global-products -- /path/to/dir   # imports from a custom directory
 *   npm run db:import-global-products -- --dry-run      # parses & reports counts, writes nothing
 */

const CONCURRENCY = 5;

// Folder name (under the import root) -> Global Category to import into.
// IDs match the existing seeded categories (see shared SEED_DATA.CATEGORIES and
// this service's own seed-db.ts CAT.BEAUTY, which isn't in SEED_DATA).
const FOLDER_TO_CATEGORY: Record<string, { id: string; label: string }> = {
  "beauty-care": { id: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380b15", label: "Beauty" },
  drinks: { id: SEED_DATA.CATEGORIES.DRINKS, label: "Drinks" },
  food: { id: SEED_DATA.CATEGORIES.GROCERY, label: "Grocery" },
  "home-care": { id: SEED_DATA.CATEGORIES.CLEANING, label: "Cleaning" },
  "personal-care": { id: SEED_DATA.CATEGORIES.PERSONAL_CARE, label: "Personal Care" },
};

interface CsvRow {
  name?: string;
  description?: string;
  image_url?: string;
}

interface Summary {
  created: number;
  skippedDuplicate: number;
  skippedNoImage: number;
  imageFailed: number;
  placeholderNamed: number;
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const dirArg = args.find((a) => !a.startsWith("--"));
  const root = dirArg ? path.resolve(dirArg) : path.join(os.homedir(), "Downloads");
  return { root, dryRun };
}

async function processCategory(
  folderPath: string,
  category: { id: string; label: string },
  repo: GlobalProductRepository,
  mediaClient: MediaClient,
  dryRun: boolean,
  summary: Summary,
): Promise<void> {
  const existing = await repo.findAllByCategory(category.id);
  const seenNames = new Set(existing.map((p) => normalizeName(p.name)));

  const csvFiles = fs.readdirSync(folderPath).filter((f) => f.toLowerCase().endsWith(".csv"));
  let placeholderIndex = 0;

  interface PendingRow {
    name: string;
    description?: string;
    imageUrl?: string;
  }
  const toCreate: PendingRow[] = [];

  for (const file of csvFiles) {
    const filePath = path.join(folderPath, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const { data } = Papa.parse<CsvRow>(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    });

    for (const row of data) {
      const rawName = (row.name || "").trim();
      const rawDescription = (row.description || "").trim();
      const imageUrl = (row.image_url || "").trim();

      let name = rawName;
      let description: string | undefined = rawDescription || undefined;

      if (!name && rawDescription) {
        // No name, but a usable description — use it as the product name.
        name = rawDescription;
        description = undefined;
      } else if (!name && !rawDescription) {
        // Neither a name nor a description — nothing to name the product from.
        placeholderIndex += 1;
        name = `${category.label} Item #${placeholderIndex}`;
        summary.placeholderNamed += 1;
      }

      const normalized = normalizeName(name);
      if (seenNames.has(normalized)) {
        summary.skippedDuplicate += 1;
        continue;
      }
      seenNames.add(normalized);

      toCreate.push({ name, description, imageUrl: imageUrl || undefined });
    }
  }

  Logger.info(`[CSV Import] ${category.label}: ${csvFiles.length} file(s), ${toCreate.length} new product(s) to create`);

  if (dryRun) {
    summary.created += toCreate.length;
    summary.skippedNoImage += toCreate.filter((r) => !r.imageUrl).length;
    return;
  }

  for (let i = 0; i < toCreate.length; i += CONCURRENCY) {
    const batch = toCreate.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (row) => {
        const product: GlobalProduct = {
          id: randomUUID(),
          name: row.name,
          description: row.description,
          globalCategoryId: category.id,
          measurementType: MeasurementType.UNIT,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await repo.create(product);
        summary.created += 1;

        if (!row.imageUrl) {
          summary.skippedNoImage += 1;
          return;
        }

        try {
          const uploaded = await mediaClient.uploadImageFromUrl(row.imageUrl, "globals", product.id);
          await repo.update(product.id, { imageUrl: uploaded.url });
        } catch (err: any) {
          summary.imageFailed += 1;
          Logger.warn(`[CSV Import] Image upload failed for "${row.name}" (${product.id}): ${err.message}`);
        }
      }),
    );
  }
}

async function run(): Promise<void> {
  const { root, dryRun } = parseArgs();
  Logger.info(`[CSV Import] Starting import from ${root}${dryRun ? " (dry run)" : ""}`);

  const db = Database.getInstance({
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
  });
  const repo = new GlobalProductRepository(db);
  const mediaClient = new MediaClient();

  const summary: Summary = { created: 0, skippedDuplicate: 0, skippedNoImage: 0, imageFailed: 0, placeholderNamed: 0 };

  for (const [folderName, category] of Object.entries(FOLDER_TO_CATEGORY)) {
    const folderPath = path.join(root, folderName);
    if (!fs.existsSync(folderPath)) {
      Logger.warn(`[CSV Import] Folder not found, skipping: ${folderPath}`);
      continue;
    }
    await processCategory(folderPath, category, repo, mediaClient, dryRun, summary);
  }

  Logger.info(
    `[CSV Import] Done. created=${summary.created} skippedDuplicate=${summary.skippedDuplicate} ` +
      `placeholderNamed=${summary.placeholderNamed} skippedNoImage=${summary.skippedNoImage} imageFailed=${summary.imageFailed}`,
  );
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    Logger.error("[CSV Import] Fatal error", err);
    process.exit(1);
  });

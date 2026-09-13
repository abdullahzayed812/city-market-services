import * as fs from "fs";
import * as path from "path";

/**
 * Minimal CSV writer/reader for load-test-generated data. Deliberately hand-rolled
 * instead of pulling in a CSV dependency: every field we ever write is a UUID,
 * email, number, or boolean - none can contain a comma, quote, or newline, so full
 * RFC 4180 escaping would be unused complexity here.
 */
export function writeCsv(filePath: string, rows: Record<string, string | number | boolean>[]): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (rows.length === 0) {
    fs.writeFileSync(filePath, "");
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => String(r[h])).join(","))];
  fs.writeFileSync(filePath, lines.join("\n") + "\n");
}

export function readCsv(filePath: string): Record<string, string>[] {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf-8").trim();
  if (!content) return [];
  const [headerLine, ...lines] = content.split("\n");
  const headers = headerLine.split(",");
  return lines.map((line) => {
    const values = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = values[i]));
    return row;
  });
}

export function appendCsv(filePath: string, rows: Record<string, string | number | boolean>[]): void {
  const existing = readCsv(filePath);
  if (existing.length === 0) {
    writeCsv(filePath, rows as any);
    return;
  }
  const headers = Object.keys(existing[0]);
  const lines = rows.map((r) => headers.map((h) => String(r[h])).join(","));
  fs.appendFileSync(filePath, lines.join("\n") + "\n");
}

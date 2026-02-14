export class Logger {
  static info(message: string, meta?: any): void {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, meta || "");
  }

  static error(message: string, error?: any): void {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error || "");
  }

  static warn(message: string, meta?: any): void {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, meta || "");
  }
}

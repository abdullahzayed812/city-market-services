import { UAParser } from "ua-parser-js";

export function parseUserAgent(userAgent: string | undefined): { browser?: string; os?: string } {
  if (!userAgent) return {};

  const parser = new UAParser(userAgent);
  const browser = parser.getBrowser();
  const os = parser.getOS();

  return {
    browser: browser.name ? `${browser.name}${browser.version ? " " + browser.version : ""}` : undefined,
    os: os.name ? `${os.name}${os.version ? " " + os.version : ""}` : undefined,
  };
}

import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import type { Browser, CookieParam, HTTPResponse, LaunchOptions, Page } from "puppeteer";
import which from "which";

const DEFAULT_CHROME_CANDIDATES: string[] = [
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "google-chrome-stable",
  "google-chrome",
  "chromium-browser",
  "chromium",
];

const USER_AGENT =
  process.env.USER_AGENT ||
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const HEADLESS = (process.env.HEADLESS || "true").toLowerCase() === "true";
const COOKIES_PATH = process.env.IG_COOKIES_PATH || path.join(__dirname, "inst_cookies.json");

interface ScrapeResult {
  url: string;
  followers: number | null;
  following: number | null;
  success: boolean;
  error?: string;
}

function findChromeExecutable(customPath?: string | null): string | null {
  if (customPath) return customPath;
  for (const candidate of DEFAULT_CHROME_CANDIDATES) {
    try {
      const resolved = which.sync(candidate, { nothrow: true });
      if (resolved) return resolved;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function buildLaunchOptions(executablePath: string | null): LaunchOptions {
  const args = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-blink-features=AutomationControlled",
  ];
  const options: LaunchOptions = {
    headless: HEADLESS,
    args,
  };
  if (executablePath) {
    options.executablePath = executablePath;
  }
  return options;
}

function loadCookiesFromDisk(): CookieParam[] {
  if (!fs.existsSync(COOKIES_PATH)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(COOKIES_PATH, "utf8"));
    if (!Array.isArray(raw)) return [];
    return raw
      .map((cookie: any) => {
        if (!cookie || typeof cookie.name !== "string" || typeof cookie.value !== "string") return null;
        const normalized: CookieParam = {
          name: cookie.name,
          value: cookie.value,
          path: cookie.path || "/",
          domain:
            typeof cookie.domain === "string" && cookie.domain.length > 0
              ? cookie.domain.replace(/^\./, "")
              : "instagram.com",
        };
        if (typeof cookie.secure === "boolean") normalized.secure = cookie.secure;
        if (typeof cookie.httpOnly === "boolean") normalized.httpOnly = cookie.httpOnly;
        if (typeof cookie.expirationDate === "number") normalized.expires = Math.round(cookie.expirationDate);
        const sameSiteMap: Record<string, CookieParam["sameSite"]> = {
          lax: "Lax",
          strict: "Strict",
          none: "None",
          no_restriction: "None",
        };
        if (typeof cookie.sameSite === "string") {
          const key = cookie.sameSite.toLowerCase();
          if (sameSiteMap[key]) normalized.sameSite = sameSiteMap[key];
        }
        const scheme = normalized.secure ? "https" : "http";
        if (normalized.domain) {
          normalized.url = `${scheme}://${normalized.domain}`;
        }
        return normalized;
      })
      .filter((entry: CookieParam | null): entry is CookieParam => entry !== null);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[inst_count] Failed to load cookies.json: ${message}`);
    return [];
  }
}

interface GraphQLCounts {
  followers: number | null;
  following: number | null;
}

function extractCountsFromPayload(payload: unknown): GraphQLCounts | null {
  if (!payload || typeof payload !== "object") return null;
  const queue: unknown[] = [payload];
  while (queue.length > 0) {
    const node = queue.shift();
    if (!node || typeof node !== "object") continue;
    const record = node as Record<string, unknown>;
    const followers =
      typeof record.follower_count === "number"
        ? record.follower_count
        : (record.edge_followed_by as { count?: number } | undefined)?.count ??
          (record.edge_followers as { count?: number } | undefined)?.count ??
          null;
    const following =
      typeof record.following_count === "number"
        ? record.following_count
        : (record.edge_follow as { count?: number } | undefined)?.count ??
          (record.edge_following as { count?: number } | undefined)?.count ??
          null;
    if (followers !== null || following !== null) {
      return {
        followers: followers ?? null,
        following: following ?? null,
      };
    }
    Object.values(record).forEach((value) => {
      if (value && typeof value === "object") {
        queue.push(value);
      }
    });
  }
  return null;
}

function waitForGraphQLCounts(page: Page, timeoutMs = 30000): Promise<GraphQLCounts> {
  return new Promise<GraphQLCounts>((resolve, reject) => {
    const timer = setTimeout(() => {
      page.off("response", handleResponse);
      reject(new Error("Follower/following counts not found."));
    }, timeoutMs);

    const handleResponse = async (response: HTTPResponse) => {
      try {
        if (!response.ok()) return;
        const url = response.url();
        if (!/\/graphql\/query/i.test(url)) return;
        const headers = response.headers() || {};
        const contentType = headers["content-type"] || headers["Content-Type"] || "";
        if (typeof contentType === "string" && !/json/i.test(contentType)) return;

        const text = await response.text();
        if (!text) return;

        let payload: unknown;
        try {
          payload = JSON.parse(text);
        } catch {
          return;
        }

        const counts = extractCountsFromPayload(payload);
        if (!counts) return;

        clearTimeout(timer);
        page.off("response", handleResponse);
        resolve(counts);
      } catch {
        /* swallow individual response parsing errors */
      }
    };

    page.on("response", handleResponse);
  });
}

function parseCount(value: number | string | null | undefined): number {
  if (typeof value === "number") return value;
  if (value === null || value === undefined) return 0;
  const raw = String(value).trim();
  if (!raw) return 0;

  const suffixMatch = raw.match(/([KMB])$/i);
  const suffix = suffixMatch ? suffixMatch[1].toUpperCase() : null;
  const numberPart = suffix ? raw.slice(0, -1) : raw;
  const cleaned = numberPart.replace(/[\s,\u202f]/g, "");
  const num = Number.parseFloat(cleaned);
  if (Number.isNaN(num)) return 0;

  if (!suffix) return Math.round(num);
  if (suffix === "K") return Math.round(num * 1_000);
  if (suffix === "M") return Math.round(num * 1_000_000);
  if (suffix === "B") return Math.round(num * 1_000_000_000);
  return Math.round(num);
}

async function scrapeProfile(url: string): Promise<ScrapeResult> {
  const chromeExec = findChromeExecutable(process.env.CHROME_PATH || null);
  const launchOpts = buildLaunchOptions(chromeExec);
  const browser = await puppeteer.launch(launchOpts);
  const page = await browser.newPage();

  try {
    await page.setUserAgent(USER_AGENT);
    await page.setExtraHTTPHeaders({ "accept-language": "en-US,en;q=0.9" });
    await page.setViewport({ width: 1280, height: 720 });

    const cookies = loadCookiesFromDisk();
    if (cookies.length) {
      try {
        await page.setCookie(...cookies);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[inst_count] Failed to apply cookies: ${message}`);
      }
    }

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });

    const counts = await waitForGraphQLCounts(page);
    const followers = parseCount(counts.followers);
    const following = parseCount(counts.following);

    return {
      url,
      followers,
      following,
      success: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error scraping ${url}: ${message}`);
    return {
      url,
      followers: null,
      following: null,
      success: false,
      error: message,
    };
  } finally {
    await browser.close();
  }
}

async function main(urls: string[]): Promise<void> {
  const results: ScrapeResult[] = [];
  let hasError = false;
  for (const url of urls) {
    const result = await scrapeProfile(url);
    results.push(result);
    if (!result.success) {
      hasError = true;
    }
  }

  console.log(JSON.stringify(results));

  if (hasError) {
    process.exitCode = 1;
  }
}

const urls = process.argv.slice(2);
if (urls.length === 0) {
  console.error("Please provide at least one Instagram profile URL.");
  process.exit(1);
}

(async () => {
  await main(urls);
})();

import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser, HTTPRequest, Page } from "puppeteer";
import * as which from "which";

puppeteer.use(StealthPlugin());

const USER_AGENT =
	process.env.USER_AGENT ||
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const NAV_TIMEOUT = Number(process.env.NAV_TIMEOUT_MS) || 15000;
const WAIT_MAIN_MS = Number(process.env.WAIT_MAIN_MS) || 15000;
const POST_NAV_PAUSE_MS = Number(process.env.POST_NAV_PAUSE_MS) || 5000;
const CHROME_PATH = process.env.CHROME_PATH || null;
const PROXY = process.env.PROXY || null;
const HEADLESS = (process.env.HEADLESS || "true").toLowerCase() === "true";
const COOKIES_PATH = process.env.IG_COOKIES_PATH || path.resolve(__dirname, "cookies.json");

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function findChromeExecutable(): string | null {
	if (CHROME_PATH) return CHROME_PATH;
	const candidates = [
		"/usr/bin/google-chrome-stable",
		"/usr/bin/google-chrome",
		"/usr/bin/chromium-browser",
		"/usr/bin/chromium",
		"google-chrome-stable",
		"google-chrome",
		"chromium-browser",
		"chromium",
	];
	for (const candidate of candidates) {
		try {
			const resolved = which.sync(candidate, { nothrow: true });
			if (resolved) return resolved;
		} catch {
			/* ignore */
		}
	}
	return null;
}

type CookieParam = Parameters<Page["setCookie"]>[0];

function loadCookies(): CookieParam[] {
	try {
		if (fs.existsSync(COOKIES_PATH)) {
			const raw = fs.readFileSync(COOKIES_PATH, "utf-8");
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed) && parsed.length > 0) {
				return parsed;
			}
		}
	} catch (error) {
		console.error("[inst_count] Failed to load cookies:", error instanceof Error ? error.message : error);
	}
	return [];
}

async function applyCookies(page: Page): Promise<void> {
	const cookies = loadCookies();
	if (cookies.length === 0) return;
	try {
		await page.setCookie(...cookies);
	} catch (error) {
		console.error("[inst_count] Failed to set cookies:", error instanceof Error ? error.message : error);
	}
}

function extractCount(headerSpans: string[], spansWithTitle: any) {
	let followers = null;
	let following = null;

	for (const text of headerSpans) {
		if (/followers$/i.test(text)) {
			if (/[KM] followers$/i.test(text)) {
				const titleSpan = spansWithTitle.find((span: any) => span.text === text.replace(" followers", "").trim());
				if (titleSpan) {
					followers = parseInt(titleSpan.title.replace(/,/g, ""));
				}
			} else {
				const match = text.match(/^([\d,]+) followers$/i);
				if (match) {
					followers = parseInt(match[1].replace(/,/g, ""));
				}
			}
		}
		if (/following$/i.test(text)) {
			const match = text.match(/^([\d,]+) following$/i);
			if (match) {
				following = parseInt(match[1].replace(/,/g, ""));
			}
		}
	}
	return { followers, following };
}

async function processUrl(
	browser: Browser,
	url: string
): Promise<{ url: string; followers: number | null; following: number | null; source: string; error?: string }> {
	const page = await browser.newPage();
	try {
		await page.setUserAgent(USER_AGENT);
		await page.setExtraHTTPHeaders({ "accept-language": "en-US,en;q=0.9" });

		await page.setRequestInterception(true);
		const requestHandler = (req: HTTPRequest) => {  "--use-gl=egl"
			const type = req.resourceType ? req.resourceType() : "";
			if (["image", "stylesheet", "font", "media", "other"].includes(type)) {
				return req.abort().catch(() => {});
			}
			return req.continue().catch(() => {});
		};
		page.on("request", requestHandler);

		await applyCookies(page);

		await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT }).catch(() => null);
		await page.waitForSelector("header", { timeout: WAIT_MAIN_MS }).catch(() => {});
		await page.waitForSelector("header span[title]", { timeout: WAIT_MAIN_MS }).catch(() => {});
		await sleep(POST_NAV_PAUSE_MS);

		const result = await page.evaluate(() => {
			const header = document.querySelector("header");
			if (!header) return null;
			const spans = header.querySelectorAll("span");
			const spansWithTitle = header.querySelectorAll("span[title]");
			const allSpans = Array.from(spans)
				.map((span) => (span.textContent ? span.textContent.trim() : ""))
				.filter(Boolean);
			const titleSpans = Array.from(spansWithTitle)
				.map((span) => ({
					text: span.textContent ? span.textContent.trim() : "",
					title: span.getAttribute("title") || "",
				}))
				.filter((entry) => entry.text || entry.title);
			return { allSpans, titleSpans };
		});

		if (!result) {
			return {
				url,
				followers: null,
				following: null,
				source: "puppeteer",
				error: "header not available",
			};
		}

		const counts = extractCount(result.allSpans, result.titleSpans);

		return {
			url,
			followers: counts.followers,
			following: counts.following,
			source: "puppeteer",
		};
	} catch (error) {
		return {
			url,
			followers: null,
			following: null,
			source: "puppeteer",
			error: error instanceof Error ? error.message : String(error),
		};
	} finally {
		try {
			page.removeAllListeners("request");
			await page.setRequestInterception(false);
		} catch {
			/* ignore */
		}
		await page.close().catch(() => {});
	}
}

async function main(urls: string[]): Promise<void> {
	const chromeExec = findChromeExecutable();
	const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
		headless: HEADLESS,
		args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
	};
	if (chromeExec) launchOptions.executablePath = chromeExec;
	if (PROXY) launchOptions.args?.push(`--proxy-server=${PROXY}`);

	let browser: Browser | null = null;
	try {
		browser = await puppeteer.launch(launchOptions);
	} catch (error) {
		urls.forEach((singleUrl) => {
			console.log(
				JSON.stringify({
					url: singleUrl,
					followers: null,
					following: null,
					source: "puppeteer",
					error: error instanceof Error ? error.message : String(error),
				})
			);
		});
		return;
	}

	for (const url of urls) {
		const result = await processUrl(browser, url);
		console.log(JSON.stringify(result));
	}

	await browser.close();
}

(async () => {
	const args = process.argv.slice(2);
	if (args.length === 0) {
		console.error("Usage: node inst_count.ts <url1> <url2> ...");
		process.exit(1);
	}
	await main(args);
})();

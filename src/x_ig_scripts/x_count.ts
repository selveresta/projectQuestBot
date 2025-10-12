/* eslint-disable no-console */
import * as fs from "fs";
import * as path from "path";
import puppeteer, { HTTPResponse, Page, LaunchOptions, CookieParam } from "puppeteer";
import which from "which";

type Counts = { followers: number | null; following: number | null };
type ScrapeOptions = { headless?: boolean };
type ScrapeResult = {
	url: string;
	followers: number | null;
	following: number | null;
	meta: { headless: boolean };
};

const CHROME_CANDIDATES = [
	"/usr/bin/google-chrome-stable",
	"/usr/bin/google-chrome",
	"/usr/bin/chromium-browser",
	"/usr/bin/chromium",
	"google-chrome-stable",
	"google-chrome",
	"chromium-browser",
	"chromium",
];

function findChromeExecutable(): string | null {
	for (const candidate of CHROME_CANDIDATES) {
		try {
			const resolved = which.sync(candidate, { nothrow: true }) as string | null;
			if (resolved) return resolved;
		} catch {
			/* ignore */
		}
	}
	return null;
}

function loadCookiesFromDisk() {
	const cookiesPath = path.join(__dirname, "x_cookies.json");
	if (!fs.existsSync(cookiesPath)) return [];
	try {
		const raw = JSON.parse(fs.readFileSync(cookiesPath, "utf8")) as unknown;
		if (!Array.isArray(raw)) return [];
		return raw.filter((item): item is CookieParam => Boolean(item?.name && item?.value)).map((cookie) => cookie);
	} catch {
		return [];
	}
}

function parseCount(value: unknown): number | null {
	if (typeof value === "number") return Math.round(value);
	if (value === null || value === undefined) return null;
	const clean = String(value).replace(/,/g, "").trim();
	if (!clean) return null;
	const match = clean.match(/^([\d.]+)\s*([MK])?$/i);
	if (match) {
		const base = parseFloat(match[1]);
		if (!Number.isFinite(base)) return null;
		const suffix = match[2]?.toUpperCase();
		const multiplier = suffix === "M" ? 1_000_000 : suffix === "K" ? 1_000 : 1;
		return Math.round(base * multiplier);
	}
	const numeric = Number(clean.replace(/[^\d]/g, ""));
	return Number.isFinite(numeric) && /\d/.test(clean) ? numeric : null;
}

function extractCountsFromPayload(payload: unknown): Counts | null {
	if (!payload || typeof payload !== "object") return null;
	const queue: unknown[] = [payload];
	while (queue.length) {
		const current = queue.shift();
		if (!current || typeof current !== "object") continue;
		const legacy = (current as { legacy?: unknown }).legacy;
		if (legacy && typeof legacy === "object") {
			const followers = (legacy as { followers_count?: unknown }).followers_count;
			const following = (legacy as { friends_count?: unknown }).friends_count;
			const normalizedFollowers = typeof followers === "number" ? followers : null;
			const normalizedFollowing = typeof following === "number" ? following : null;
			if (normalizedFollowers !== null || normalizedFollowing !== null) {
				return { followers: normalizedFollowers, following: normalizedFollowing };
			}
		}
		for (const value of Object.values(current)) {
			if (value && typeof value === "object") queue.push(value);
		}
	}
	return null;
}

function waitForGraphQLCounts(page: Page, timeoutMs = 30_000): Promise<Counts> {
	return new Promise<Counts>((resolve, reject) => {
		const timer = setTimeout(() => {
			page.off("response", handler);
			reject(new Error("Follower/following counts not found (GraphQL timeout)."));
		}, timeoutMs);

		const handler = async (response: HTTPResponse): Promise<void> => {
			try {
				if (!response.ok()) return;
				const url = response.url();
				if (!/\/i\/api\/graphql\/.+\/UserByScreenName/.test(url)) return;
				const headers = response.headers() ?? {};
				const contentType = headers["content-type"] || headers["Content-Type"] || "";
				if (!/application\/json/i.test(String(contentType))) return;
				const payload = await response.json().catch(() => null);
				if (!payload) return;
				const counts = extractCountsFromPayload(payload);
				if (!counts) return;
				clearTimeout(timer);
				page.off("response", handler);
				resolve(counts);
			} catch {
				/* ignore individual response errors */
			}
		};

		page.on("response", handler);
	});
}

async function scrapeTwitterProfile(url: string, opts: ScrapeOptions = {}): Promise<ScrapeResult> {
	const chromeExec = findChromeExecutable();
	const headless =
		typeof opts.headless === "boolean" ? opts.headless : process.env.HEADLESS ? /^(1|true|yes)$/i.test(process.env.HEADLESS) : true;

	const launchOpts: LaunchOptions = {
		headless,
		args: [
			"--no-sandbox",
			"--disable-setuid-sandbox",
			"--disable-dev-shm-usage",
			"--hide-scrollbars",
			"--window-size=1366,900",
			"--use-gl=egl",
		],
		defaultViewport: null,
	};

	if (chromeExec) launchOpts.executablePath = chromeExec;

	const browser = await puppeteer.launch(launchOpts);
	const page = await browser.newPage();

	await page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
	await page.setViewport({ width: 1366, height: 900, deviceScaleFactor: 1 });
	await page.evaluateOnNewDocument(() => {
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore - executed in browser context
		Object.defineProperty(navigator, "webdriver", { get: () => false });
	});

	const cookies = loadCookiesFromDisk();
	if (cookies.length) {
		try {
			await page.setCookie(...cookies);
		} catch (error) {
			console.error("[finder] cookie set error:", (error as Error).message);
		}
	}

	const countsPromise = waitForGraphQLCounts(page);

	try {
		await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
	} catch (error) {
		await browser.close();
		throw new Error(`Navigation failed: ${(error as Error).message}`);
	}

	const apiCounts = await countsPromise;
	const followers = parseCount(apiCounts.followers);
	const following = parseCount(apiCounts.following);

	await browser.close();

	return {
		url,
		followers,
		following,
		meta: { headless },
	};
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	if (!args.length) {
		console.error('Usage:\n  HEADLESS=true ts-node text_x.ts "https://x.com/thenotcoin" [--json]');
		process.exit(1);
	}
	const asJson = true;
	const urls = args.filter((arg) => arg !== "--json");

	for (const url of urls) {
		try {
			const result = await scrapeTwitterProfile(url);
			if (asJson) {
				console.log(JSON.stringify(result));
			} else {
				console.log(`URL: ${result.url}`);
				console.log(`Followers: ${result.followers ?? "unknown"}`);
				console.log(`Following: ${result.following ?? "unknown"}`);
				console.log(`Headless=${result.meta.headless}`);
			}
		} catch (error) {
			console.error("Error:", (error as Error).message);
		}
	}
}

if (require.main === module) {
	void main();
}

import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser, HTTPRequest, Page } from "puppeteer";
import which from "which";

puppeteer.use(StealthPlugin());

const NAV_TIMEOUT = Number(process.env.NAV_TIMEOUT_MS) || 20000;
const WAIT_MAIN_MS = Number(process.env.WAIT_MAIN_MS) || 7000;
const POST_NAV_PAUSE_MS = Number(process.env.POST_NAV_PAUSE_MS) || 10000;
const HEADLESS = (process.env.HEADLESS || "true").toLowerCase() === "true";
const CHROME_PATH = process.env.CHROME_PATH || null;
const PROXY = process.env.PROXY || null;
const USER_AGENT =
	process.env.USER_AGENT ||
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function sleep(ms: number): Promise<void> {
	return new Promise((res) => setTimeout(res, ms));
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
		} catch (error) {
			/* ignore */
		}
	}
	return null;
}

function parseCount(sample: string | null): number | null {
	if (!sample) return null;
	const raw = sample.trim();
	if (!raw) return null;

	const match = raw.match(/([\d]+(?:[.,\s]\d+)*)(\s*(?:[kKmMкКМм]|тис\.?|тыс\.?|млн\.?|мил\.?))?/i);
	if (!match) return null;

	let numberPart = match[1].replace(/\s+/g, "");
	const suffix = match[2] ? match[2].trim().toLowerCase() : null;

	if (numberPart.includes(".") && numberPart.includes(",")) {
		numberPart = numberPart.replace(/,/g, "");
	} else if (numberPart.includes(",") && !numberPart.includes(".")) {
		const parts = numberPart.split(",");
		if (parts[1] && parts[1].length === 3) {
			numberPart = parts.join("");
		} else {
			numberPart = parts.join(".");
		}
	} else {
		numberPart = numberPart.replace(/,/g, "");
	}

	let value = Number.parseFloat(numberPart);
	if (!Number.isFinite(value)) return null;

	if (suffix === "k" || suffix === "к" || suffix === "тис" || suffix === "тис." || suffix === "тыс" || suffix === "тыс.") {
		value *= 1_000;
	} else if (suffix === "m" || suffix === "м" || suffix === "млн" || suffix === "млн." || suffix === "мил" || suffix === "мил.") {
		value *= 1_000_000;
	}

	return Math.round(value);
}

async function extractCounts(page: Page): Promise<{ followers: number | null; following: number | null }> {
	const data = await page.evaluate(() => {
		const header = document.querySelector("header");
		if (!header) return null;
		const spanElements = Array.from(header.querySelectorAll("span"));
		const spansWithTitle = Array.from(header.querySelectorAll("span[title]"));
		return {
			spanTexts: spanElements.map((span) => span.textContent || ""),
			spansWithTitle: spansWithTitle.map((span) => ({
				text: span.textContent || "",
				title: span.getAttribute("title") || "",
			})),
		};
	});

	if (!data) {
		return { followers: null, following: null };
	}

	const spans = data.spanTexts.map((text) => text.trim()).filter(Boolean);
	const titleEntries = data.spansWithTitle
		.map((span) => ({ text: span.text.trim(), title: span.title ? span.title.trim() : "" }))
		.filter((entry) => entry.text || entry.title);

	const findTitleByText = (text: string): number | null => {
		const key = text.trim().replace(/\s+/g, " ");
		if (!key) return null;
		const entry = titleEntries.find((item) => item.text === key);
		if (!entry) return null;
		return parseCount(entry.title || entry.text);
	};

	let followers: number | null = null;
	let following: number | null = null;

	for (let index = 0; index < spans.length; index++) {
		const rawText = spans[index];
		const lower = rawText.toLowerCase();

		if (lower.endsWith("followers")) {
			const base = rawText.replace(/followers$/i, "").trim();
			let value = parseCount(base);
			if (value === null) value = findTitleByText(base);
			if (value === null && titleEntries.length > 0) {
				const fallback = titleEntries
					.map((entry) => parseCount(entry.title || entry.text))
					.filter((v): v is number => v !== null)
					.sort((a, b) => b - a)[0];
				if (fallback !== undefined) value = fallback;
			}
			if (value !== null) followers = value;
		}

		if (lower.endsWith("following")) {
			const base = rawText.replace(/following$/i, "").trim();
			let value = parseCount(base);
			if (value === null) value = findTitleByText(base);
			if (value !== null) following = value;
		}

		if (followers !== null && following !== null) {
			break;
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
		await page.setViewport({ width: 1280, height: 720 });

		await page.setRequestInterception(true);
		page.on("request", (req: HTTPRequest) => {
			try {
				const type = req.resourceType ? req.resourceType() : "";
				if (["image", "stylesheet", "font", "media", "other"].includes(type)) {
					return req.abort();
				}
				return req.continue();
			} catch {
				try {
					req.continue();
				} catch {
					/* ignore */
				}
			}
		});

		await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT }).catch(() => null);
		await page.waitForSelector("header", { timeout: WAIT_MAIN_MS }).catch(() => {});
		await page.waitForSelector("header span", { timeout: WAIT_MAIN_MS }).catch(() => {});
		await sleep(POST_NAV_PAUSE_MS);

		const counts = await extractCounts(page);

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
		console.error("Usage: node x_count.ts <url1> <url2> ...");
		process.exit(1);
	}
	await main(args);
})();

const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const path = require("path");
const which = require("which");

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

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function findChromeExecutable() {
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
		} catch (e) {}
	}
	return null;
}

function loadCookies() {
	try {
		if (fs.existsSync(COOKIES_PATH)) {
			const raw = fs.readFileSync(COOKIES_PATH, "utf-8");
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed) && parsed.length > 0) {
				return parsed;
			}
		}
	} catch (error) {
		console.error("[inst_count] Failed to load cookies:", error.message || error);
	}
	return [];
}

async function applyCookies(page) {
	const cookies = loadCookies();
	if (cookies.length === 0) {
		return;
	}
	try {
		await page.setCookie(...cookies);
	} catch (error) {
		console.error("[inst_count] Failed to set cookies:", error.message || error);
	}
}

// async function extractCountsFromPage(page) {
// 	return page.evaluate(() => {
// 		const parseCountValue = (sample) => {
// 			if (!sample && sample !== 0) return null;
// 			const raw = String(sample).trim();
// 			if (!raw) return null;

// 			// Remove HTML entities like &nbsp;
// 			const cleaned = raw.replace(/&nbsp;/g, "").replace(/&#160;/g, "");

// 			const match = cleaned.match(/([\d]+(?:[.,\s]\d+)*)(\s*(?:[kKmMкКМм]|тис\.?|тыс\.?|млн\.?|мил\.?))?/i);
// 			if (!match) return null;

// 			let numberPart = match[1].replace(/\s+/g, "");
// 			const suffix = match[2] ? match[2].trim().toLowerCase() : null;

// 			if (numberPart.includes(".") && numberPart.includes(",")) {
// 				numberPart = numberPart.replace(/,/g, "");
// 			} else if (numberPart.includes(",") && !numberPart.includes(".")) {
// 				const parts = numberPart.split(",");
// 				if (parts[1] && parts[1].length === 3) {
// 					numberPart = parts.join("");
// 				} else {
// 					numberPart = parts.join(".");
// 				}
// 			} else {
// 				numberPart = numberPart.replace(/,/g, "");
// 			}

// 			let value = Number.parseFloat(numberPart);
// 			if (!Number.isFinite(value)) return null;

// 			if (suffix === "k" || suffix === "к" || suffix === "тис" || suffix === "тис." || suffix === "тыс" || suffix === "тыс.") {
// 				value *= 1_000;
// 			} else if (suffix === "m" || suffix === "м" || suffix === "млн" || suffix === "млн." || suffix === "мил" || suffix === "мил.") {
// 				value *= 1_000_000;
// 			}

// 			return Math.round(value);
// 		};

// 		const counts = {
// 			followers: null,
// 			following: null,
// 		};

// 		// Strategy: Find span[title] elements in header section that contain large numbers
// 		// Instagram typically shows follower/following counts as the first two numeric spans with title
// 		const header = document.querySelector("header");
// 		if (header) {
// 			const titleSpans = Array.from(header.querySelectorAll("span[title]"));
// 			const numericValues = [];

// 			for (const span of titleSpans) {
// 				const titleValue = span.getAttribute("title");
// 				const parsed = parseCountValue(titleValue);

// 				// Only consider values that are likely follower/following counts (> 0)
// 				if (parsed !== null && parsed > 0) {
// 					// Check if this span is inside an anchor
// 					const closestAnchor = span.closest("a");
// 					const anchorHref = closestAnchor ? closestAnchor.getAttribute("href") : null;

// 					numericValues.push({
// 						value: parsed,
// 						anchorHref: anchorHref,
// 						span: span,
// 					});
// 				}
// 			}

// 			// Try to identify by anchor href first
// 			for (const item of numericValues) {
// 				if (item.anchorHref) {
// 					if (item.anchorHref.includes("/followers") && counts.followers === null) {
// 						counts.followers = item.value;
// 					} else if (item.anchorHref.includes("/following") && counts.following === null) {
// 						counts.following = item.value;
// 					}
// 				}
// 			}

// 			// If not found by anchor, use the first two large numeric values
// 			// Instagram shows them in order: followers, following
// 			if (counts.followers === null || counts.following === null) {
// 				const largeNumbers = numericValues.filter((item) => item.value >= 10); // Filter small numbers like "24", "95", "1"

// 				if (largeNumbers.length >= 2) {
// 					if (counts.followers === null) counts.followers = largeNumbers[0].value;
// 					if (counts.following === null) counts.following = largeNumbers[1].value;
// 				} else if (largeNumbers.length === 1) {
// 					// Only one large number found, likely followers
// 					if (counts.followers === null) counts.followers = largeNumbers[0].value;
// 				}
// 			}
// 		}

// 		return counts;
// 	});
// }

function extractCount(headerSpans, spansWithTitle) {
	let followers = null;
	let following = null;

	for (const text of headerSpans) {
		if (/followers$/i.test(text)) {
			if (/[KM] followers$/i.test(text)) {
				const titleSpan = spansWithTitle.find((span) => span.text === text.replace(" followers", "").trim());
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

async function processUrl(browser, url) {
	const page = await browser.newPage();
	try {
		await page.setUserAgent(USER_AGENT);
		await page.setExtraHTTPHeaders({ "accept-language": "en-US,en;q=0.9" });

		await page.setRequestInterception(true);
		const requestHandler = (req) => {
			const type = req.resourceType ? req.resourceType() : "";
			if (["image", "stylesheet", "font", "media"].includes(type)) {
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

		// const counts = await extractCountsFromPage(page);

		const result = await page.evaluate(() => {
			const header = document.querySelector("header");
			if (!header) return null;
			const spans = header.querySelectorAll("span");
			const spansWithTitle = header.querySelectorAll("span[title]");
			const allSpans = Array.from(spans).map((span) => span.textContent.trim());
			const titleSpans = Array.from(spansWithTitle).map((span) => ({
				text: span.textContent.trim(),
				title: span.getAttribute("title"),
			}));
			return { allSpans, titleSpans };
		});

		const counts = extractCount(result.allSpans, result.titleSpans);

		return {
			url,
			followers: counts.followers,
			following: counts.following,
			source: "puppeteer",
		};
	} catch (error) {
		return { url, followers: null, following: null, error: String(error) };
	} finally {
		try {
			page.removeAllListeners("request");
			await page.setRequestInterception(false);
		} catch (e) {}
		try {
			await page.close();
		} catch (e) {}
	}
}

async function main(urls) {
	const chromeExec = findChromeExecutable();
	const launchOptions = {
		headless: HEADLESS,
		args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
	};
	if (chromeExec) launchOptions.executablePath = chromeExec;
	if (PROXY) launchOptions.args.push(`--proxy-server=${PROXY}`);

	let browser;
	try {
		browser = await puppeteer.launch(launchOptions);
	} catch (error) {
		for (const url of urls) {
			console.log(JSON.stringify({ url, followers: null, following: null, error: `browser launch failed: ${String(error)}` }));
		}
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
	if (!args.length) {
		console.log("Usage: node inst_count.js <url1> <url2> ...");
		process.exit(1);
	}
	await main(args);
})();

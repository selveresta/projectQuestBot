// inst_find_followers_hover_by_suffix.js
// Usage:
// CHROME_PATH=/usr/bin/google-chrome-stable HEADLESS=false node inst_find_followers_hover_by_suffix.js <url1> <url2> ...

const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const which = require("which");
puppeteer.use(StealthPlugin());

// ---------- Configuration ----------
const NAV_TIMEOUT = Number(process.env.NAV_TIMEOUT_MS) || 20000;
const WAIT_MAIN_MS = Number(process.env.WAIT_MAIN_MS) || 7000;
const POST_NAV_PAUSE_MS = Number(process.env.POST_NAV_PAUSE_MS) || 10000;
const MAX_NODES_TO_SCAN = Number(process.env.MAX_NODES_TO_SCAN) || 1000;
const HOVER_WAIT_MS = Number(process.env.HOVER_WAIT_MS) || 600;

const USER_AGENT =
	process.env.USER_AGENT ||
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const HEADLESS = (process.env.HEADLESS || "false") === "false" ? false : false;

function sleep(ms) {
	return new Promise((res) => setTimeout(res, ms));
}

const DEFAULT_CHROME_CANDIDATES = [
	"/usr/bin/google-chrome-stable",
	"/usr/bin/google-chrome",
	"/usr/bin/chromium-browser",
	"/usr/bin/chromium",
	"google-chrome-stable",
	"google-chrome",
	"chromium-browser",
	"chromium",
];

// ---------- Helpers ----------
function log(...args) {
	console.error("[finder]", ...args);
}

function findChromeExecutable(customPath) {
	if (customPath) return customPath;
	for (const candidate of DEFAULT_CHROME_CANDIDATES) {
		try {
			const p = which.sync(candidate, { nothrow: true });
			if (p) return p;
		} catch (e) {}
	}
	return null;
}

function buildLaunchOptions(executablePath) {
	const args = [
		"--no-sandbox",
		"--disable-setuid-sandbox",
		"--disable-dev-shm-usage",
		"--disable-blink-features=AutomationControlled",
		"--no-proxy-server",
	];
	const opts = {
		headless: HEADLESS,
		args,
	};
	if (executablePath) opts.executablePath = executablePath;
	return opts;
}

async function enableSafeRequestInterception(page) {
	try {
		await page.setRequestInterception(true);
	} catch (e) {
		return;
	}

	const blockedPatterns = /doubleclick|googlesyndication|adsystem|hotjar|mixpanel|segment|amplitude|facebook\.com|analytics/i;

	page.on("request", (req) => {
		try {
			const rt = req.resourceType ? req.resourceType() : "";
			const url = req.url();

			if (["document", "script", "xhr", "fetch", "stylesheet"].includes(rt)) {
				return req.continue();
			}

			if (blockedPatterns.test(url)) {
				return req.abort().catch(() => {});
			}

			if (["image", "media", "font"].includes(rt)) {
				return req.abort().catch(() => {});
			}

			return req.continue();
		} catch (e) {
			try {
				req.continue();
			} catch {}
		}
	});
}

async function preparePage(page) {
	await page.setUserAgent(USER_AGENT);
	await page.setExtraHTTPHeaders({ "accept-language": "en-US,en;q=0.9" });
	try {
		await enableSafeRequestInterception(page);
	} catch (e) {}
}

async function waitForMain(page) {
	try {
		await page.waitForSelector("main", { timeout: WAIT_MAIN_MS });
		return true;
	} catch (e) {
		return false;
	}
}

/**
 * Find followers and following counts with hover support for abbreviated numbers
 */
async function extractFollowerData(page, hoverWaitMs) {
	return await page.evaluate(async (hoverWaitMs) => {
		function safeText(el) {
			try {
				return (el.innerText || el.textContent || "").trim();
			} catch (e) {
				return "";
			}
		}

		function safeAttr(el, name) {
			try {
				return el.getAttribute ? el.getAttribute(name) || "" : "";
			} catch (e) {
				return "";
			}
		}

		function sleep(ms) {
			return new Promise((resolve) => setTimeout(resolve, ms));
		}

		function parseCountFromSample(sample) {
			if (!sample || typeof sample !== "string") return null;
			const s = sample.trim();
			const m = s.match(/([\d]+(?:[.,\d]*)?)\s*([kKmM]|[кКМм])?/);
			if (!m) return null;
			let numStr = m[1];
			const suffix = m[2] ? m[2].toLowerCase() : null;

			if (numStr.includes(".") && numStr.includes(",")) {
				numStr = numStr.replace(/,/g, "");
			} else if (numStr.includes(",") && !numStr.includes(".")) {
				const parts = numStr.split(",");
				if (parts[1] && parts[1].length === 3) {
					numStr = parts.join("");
				} else {
					numStr = numStr.replace(",", ".");
				}
			}

			let value = parseFloat(numStr);
			if (Number.isNaN(value)) return null;

			if (suffix === "k" || suffix === "к") value *= 1e3;
			if (suffix === "m" || suffix === "м") value *= 1e6;

			return value;
		}

		function extractFullCount(spans, approximateCount) {
			const tolerance = 0.15;
			const minVal = approximateCount * (1 - tolerance);
			const maxVal = approximateCount * (1 + tolerance);

			for (const span of spans) {
				const numMatch = span.match(/^([\d,]+)$/);
				if (numMatch) {
					const cleaned = numMatch[1].replace(/,/g, "");
					const num = parseInt(cleaned, 10);
					if (!isNaN(num) && num >= minVal && num <= maxVal) {
						return num;
					}
				}
			}
			return null;
		}

		async function hoverAndExtract(node, originalSample) {
			try {
				const rect = node.getBoundingClientRect();
				if (rect && rect.width > 0 && rect.height > 0) {
					const mouseOverEvent = new MouseEvent("mouseover", {
						view: window,
						bubbles: true,
						cancelable: true,
						clientX: rect.left + rect.width / 2,
						clientY: rect.top + rect.height / 2,
					});
					node.dispatchEvent(mouseOverEvent);

					const mouseEnterEvent = new MouseEvent("mouseenter", {
						view: window,
						bubbles: true,
						cancelable: true,
					});
					node.dispatchEvent(mouseEnterEvent);

					await sleep(hoverWaitMs);

					const allSpans = Array.from(document.querySelectorAll("span"))
						.map((s) => safeText(s))
						.filter(Boolean);

					const uniqueSpans = Array.from(new Set(allSpans));
					const parsedApprox = parseCountFromSample(originalSample);

					if (parsedApprox) {
						return extractFullCount(uniqueSpans, parsedApprox);
					}
				}
			} catch (err) {
		// console.log(`[Browser] Hover error: ${err.message}`);
			}
			return null;
		}

		const tokens = {
			followers: ["followers", "підписники", "підписник", "подписчик", "подписчики", "seguidores", "abonnenten", "abonné"],
			following: ["following", "читачі", "seguindo", "folge ich", "abonnements"],
		};

		const numPattern = /(?:\d[\d.,]*)/;
		const suffixPattern = /[kKmMкКМм]/;
		const main = document.querySelector("main");

		if (!main) return { error: "no_main" };

		const nodes = Array.from(main.querySelectorAll("a, span"));
		const result = {
			followers: null,
			following: null,
		};

		for (const node of nodes) {
			if (result.followers && result.following) break;

			const rawTexts = [safeText(node), safeAttr(node, "title"), safeAttr(node, "aria-label")].filter(Boolean);

			if (!rawTexts.length) continue;

			for (const originalSample of rawTexts) {
				const lowerSample = originalSample.toLowerCase();

				if (!numPattern.test(originalSample)) continue;

				// Check for followers
				if (!result.followers) {
					for (const token of tokens.followers) {
						if (lowerSample.includes(token)) {
							const hasSuffix = suffixPattern.test(originalSample);
							if (hasSuffix) {
								const fullCount = await hoverAndExtract(node, originalSample);
								await sleep(1000);
								result.followers = fullCount || parseCountFromSample(originalSample);
							} else {
								result.followers = parseCountFromSample(originalSample);
							}
							break;
						}
					}
				}

				// Check for following
				if (!result.following) {
					for (const token of tokens.following) {
						if (lowerSample.includes(token)) {
							const hasSuffix = suffixPattern.test(originalSample);
							if (hasSuffix) {
								const fullCount = await hoverAndExtract(node, originalSample);
								result.following = fullCount || parseCountFromSample(originalSample);
							} else {
								result.following = parseCountFromSample(originalSample);
							}
							break;
						}
					}
				}
			}
		}

		return result;
	}, hoverWaitMs);
}

// ---------- Main flow ----------
async function processUrl(browser, url) {
	const page = await browser.newPage();
	try {
		await preparePage(page);
		await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT }).catch(() => null);
		await waitForMain(page).catch(() => {});
		await sleep(POST_NAV_PAUSE_MS);

		const result = await extractFollowerData(page, HOVER_WAIT_MS);

		try {
			await page.setRequestInterception(false);
		} catch (e) {}

		if (result && result.error) {
			return { url, error: result.error };
		}

		return {
			url,
			followers: result.followers,
			following: result.following,
		};
	} catch (err) {
		return { url, error: String(err) };
	} finally {
		try {
			await page.close();
		} catch {}
	}
}

(async function main() {
	const args = process.argv.slice(2);
	if (!args.length) {
	console.log("Usage: node inst_find_followers_hover_by_suffix.js <url1> <url2> ...");
		process.exit(1);
	}

	const chromeExec = findChromeExecutable(process.env.CHROME_PATH || null);
	if (!chromeExec) {
		log("No Chrome executable found; attempting default launch (may fail).");
	}

	const launchOpts = buildLaunchOptions(chromeExec);
	let browser;
	try {
		browser = await puppeteer.launch(launchOpts);
	} catch (e) {
		console.error("Failed to launch browser:", e && e.message ? e.message : e);
		process.exit(2);
	}

	for (const url of args) {
		log("Processing", url);
		const out = await processUrl(browser, url);
	console.log(JSON.stringify(out));
	}

	try {
		await browser.close();
	} catch (e) {}
	process.exit(0);
})();

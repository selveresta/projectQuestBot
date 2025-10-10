const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
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
const HEADLESS = (process.env.HEADLESS || "true").toLowerCase() === "false";

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCount(sample) {
	if (!sample && sample !== 0) return null;
	const raw = String(sample).trim();
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

async function extractCountsFromPage(page) {
	return page.evaluate(() => {
		const parseCountValue = (sample) => {
			if (!sample && sample !== 0) return null;
			const raw = String(sample).trim();
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
		};

		const FOLLOWERS_TOKENS = [
			"followers",
			"підписники",
			"підписник",
			"подписчики",
			"подписчик",
			"читачі",
			"seguidores",
			"abonnés",
			"abonnenten",
			"abonentów",
		];
		const FOLLOWING_TOKENS = [
			"following",
			"стежить",
			"підписки",
			"підписок",
			"подписки",
			"подписок",
			"seguindo",
			"abonnements",
			"folge",
		];

		const collectComputedContent = (element) => {
			const values = [];
			if (!element) return values;
			try {
				const before = window.getComputedStyle(element, "::before").content;
				if (before && before !== "none") values.push(before.replace(/^["']|["']$/g, ""));
			} catch (e) {}
			try {
				const after = window.getComputedStyle(element, "::after").content;
				if (after && after !== "none") values.push(after.replace(/^["']|["']$/g, ""));
			} catch (e) {}
			return values;
		};

		const parseFromElement = (element) => {
			if (!element) return null;
			const candidates = [];
			if (element.textContent) candidates.push(element.textContent);
			element.querySelectorAll("span").forEach((span) => {
				if (span.textContent) candidates.push(span.textContent);
				const title = span.getAttribute("title");
				if (title) candidates.push(title);
			});
			collectComputedContent(element).forEach((value) => candidates.push(value));

			for (const candidate of candidates) {
				const parsed = parseCountValue(candidate);
				if (parsed !== null) return parsed;
			}
			return null;
		};

		const setIfEmpty = (counts, key, value, source) => {
			if (value === null || value === undefined) return false;
			if (counts[key] === null) {
				counts[key] = value;
				counts.log.push(`${source}: set ${key}=${value}`);
				return true;
			}
			return false;
		};

		const counts = {
			followers: null,
			following: null,
			log: [],
		};

		const spans = Array.from(document.querySelectorAll("span[title]"));
		counts.log.push(`Found span[title] count: ${spans.length}`);

		for (const span of spans) {
			const titleValue = span.getAttribute("title");
			counts.log.push(`Title value: ${titleValue}`);
			const parsed = parseCountValue(titleValue);
			counts.log.push(`Parsed value: ${parsed}`);
			if (parsed === null) continue;

			const followersAnchor = span.closest("a[href*='/followers']");
			const followingAnchor = span.closest("a[href*='/following']");
			counts.log.push(`Followers anchor: ${!!followersAnchor}, Following anchor: ${!!followingAnchor}`);

      if (followersAnchor) {
        setIfEmpty(counts, "followers", parsed, "span[title]");
      }
      if (followingAnchor) {
        setIfEmpty(counts, "following", parsed, "span[title]");
      }

      if (counts.followers === null) {
        const normalized = (span.textContent || "").toLowerCase();
        if (FOLLOWERS_TOKENS.some((token) => normalized.includes(token))) {
          setIfEmpty(counts, "followers", parsed, "span[title]-label-match");
        }
      }
      if (counts.following === null) {
        const normalized = (span.textContent || "").toLowerCase();
        if (FOLLOWING_TOKENS.some((token) => normalized.includes(token))) {
          setIfEmpty(counts, "following", parsed, "span[title]-label-match");
        }
      }

			if (counts.followers !== null && counts.following !== null) {
				break;
			}
		}

		const header = document.querySelector("header");
		if (header && (counts.followers === null || counts.following === null)) {
			const anchors = Array.from(header.querySelectorAll("a[href*='/followers'], a[href*='/following']"));
			counts.log.push(`Header anchors: ${anchors.length}`);
			for (const anchor of anchors) {
				const text = anchor.textContent || "";
				const normalized = text.toLowerCase();
				counts.log.push(`Anchor text: ${text}`);

				let role = null;
				if (FOLLOWERS_TOKENS.some((token) => normalized.includes(token))) {
					role = "followers";
				} else if (FOLLOWING_TOKENS.some((token) => normalized.includes(token))) {
					role = "following";
				}

				if (!role) {
					continue;
				}

				let value = parseFromElement(anchor);
				counts.log.push(`Anchor parsed (${role}): ${value}`);
				if (value === null) {
					const container = anchor.closest("li") || anchor.parentElement;
					value = parseFromElement(container);
					counts.log.push(`Container parsed (${role}): ${value}`);
				}

				if (value === null) {
					const dirSpans = Array.from(anchor.querySelectorAll("span[dir='auto']"));
					counts.log.push(`dir="auto" spans in anchor: ${dirSpans.length}`);
					for (const dirSpan of dirSpans) {
						counts.log.push(`dir="auto" content: ${dirSpan.textContent}`);
						value = parseFromElement(dirSpan);
						if (value !== null) break;
					}
				}

				if (value === null) {
					collectComputedContent(anchor).forEach((candidate) => {
						if (value === null) {
							value = parseCountValue(candidate);
							counts.log.push(`Pseudo parsed (${role}): ${value}`);
						}
					});
				}

				if (setIfEmpty(counts, role, value, "header-anchor") && counts.followers !== null && counts.following !== null) {
					break;
				}
			}
		}

		if (counts.followers === null || counts.following === null) {
			const dirSpans = Array.from(document.querySelectorAll("span[dir='auto']"));
			counts.log.push(`Global dir="auto" spans: ${dirSpans.length}`);
			for (const span of dirSpans) {
				const text = span.textContent || "";
				const normalized = text.toLowerCase();
				if (counts.followers === null && FOLLOWERS_TOKENS.some((token) => normalized.includes(token))) {
					const value = parseFromElement(span);
					counts.log.push(`dir auto followers parsed: ${value}`);
					if (setIfEmpty(counts, "followers", value, "dir-auto") && counts.following !== null) {
						break;
					}
				}
				if (counts.following === null && FOLLOWING_TOKENS.some((token) => normalized.includes(token))) {
					const value = parseFromElement(span);
					counts.log.push(`dir auto following parsed: ${value}`);
					if (setIfEmpty(counts, "following", value, "dir-auto") && counts.followers !== null) {
						break;
					}
				}
			}
		}

		return counts;
	});
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

		await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT }).catch(() => null);
		await page.waitForSelector("header", { timeout: WAIT_MAIN_MS }).catch(() => {});
		await page.waitForSelector("header a", { timeout: WAIT_MAIN_MS }).catch(() => {});
		await page.waitForSelector("main", { timeout: WAIT_MAIN_MS }).catch(() => {});
		await page.waitForSelector("span", { timeout: WAIT_MAIN_MS }).catch(() => {});
		await sleep(POST_NAV_PAUSE_MS);

		const counts = await extractCountsFromPage(page);
		for (const line of counts.log) {
			console.log(`[page-log] ${line}`);
		}

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

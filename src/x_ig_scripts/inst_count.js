// inst_counts_single_worker.js
// Usage:
//   CHROME_PATH=/usr/bin/google-chrome-stable PROXY=http://user:pass@proxy:port node inst_counts_single_worker.js <url1> <url2> ...
//
// Behavior:
// 1) try fast HTTP parse (axios+cheerio) -> if success, return fast result
// 2) open a single browser, for each URL:
//    a) PASS A: load WITHOUT blocking -> try inline JSON / meta
//    b) PASS B: if A failed -> reload WITH resource-blocking -> DOM-first extract
//
// Notes: tune timeouts and USER_AGENT via env vars.

const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const axios = require("axios");
const cheerio = require("cheerio");
const which = require("which");

puppeteer.use(StealthPlugin());

const USER_AGENT =
	process.env.USER_AGENT ||
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const FASTPATH_TIMEOUT = Number(process.env.FASTPATH_TIMEOUT_MS) || 4000;
const NAV_TIMEOUT = Number(process.env.NAV_TIMEOUT_MS) || 15000;
const PASS_B_WAIT_MS = Number(process.env.PASS_B_WAIT_MS) || 500;
const CHROME_PATH = process.env.CHROME_PATH || null;
const PROXY = process.env.PROXY || null;
const HEADLESS = (process.env.HEADLESS || "true") === "true";

function sleep(ms) {
	return new Promise((res) => setTimeout(res, ms));
}
function parseNumber(s) {
	if (!s && s !== 0) return null;
	const cleaned = String(s).replace(/[^\d]/g, "");
	return cleaned.length ? Number(cleaned) : null;
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
	for (const c of candidates) {
		try {
			const p = which.sync(c, { nothrow: true });
			if (p) return p;
		} catch (e) {}
	}
	return null;
}

// Fast HTTP parse (cheerio)
async function fastHtmlTry(url) {
	try {
		const res = await axios.get(url, { timeout: FASTPATH_TIMEOUT, headers: { "User-Agent": USER_AGENT } });
		const $ = cheerio.load(res.data);

		// meta description (often has counts, but can be stale)
		const meta = $('meta[name="description"]').attr("content");
		if (meta) {
			const f = (meta.match(/([\d.,]+)\s*Followers?/i) || [])[1] || null;
			const g = (meta.match(/([\d.,]+)\s*Following/i) || [])[1] || null;
			if (f || g) return { url, followers: f ? parseNumber(f) : null, following: g ? parseNumber(g) : null, source: "meta(fast)" };
		}

		// anchors like /followers/ /following/
		let followers = null,
			following = null;
		$("a[href]").each((i, el) => {
			const href = $(el).attr("href") || "";
			const text = $(el).text() || "";
			if (/\/followers\/?$/.test(href) && followers === null) {
				const m = text.match(/([\d.,]+)/);
				if (m) followers = parseNumber(m[1]);
			}
			if (/\/following\/?$/.test(href) && following === null) {
				const m = text.match(/([\d.,]+)/);
				if (m) following = parseNumber(m[1]);
			}
		});
		if (followers !== null || following !== null) return { url, followers, following, source: "dom(fast)" };

		return null;
	} catch (e) {
		return null; // network or 403 etc -> fallback to browser
	}
}

// extract inline JSON (window._sharedData or __additionalDataLoaded) from page context
async function extractInlineJSON(page) {
	return await page.evaluate(() => {
		try {
			const scripts = Array.from(document.querySelectorAll("script"))
				.map((s) => s.innerText)
				.filter(Boolean);
			for (const s of scripts) {
				let m = s.match(/window\._sharedData\s*=\s*(\{[\s\S]*\})\s*;/);
				if (m && m[1]) {
					try {
						const obj = JSON.parse(m[1]);
						const user = obj?.entry_data?.ProfilePage?.[0]?.graphql?.user || obj?.graphql?.user;
						if (user)
							return {
								followers: user.edge_followed_by?.count ?? null,
								following: user.edge_follow?.count ?? null,
								source: "window._sharedData",
							};
					} catch (e) {}
				}
				m = s.match(/window\.__additionalDataLoaded\([^,]+,\s*(\{[\s\S]*\})\s*\)\s*;/);
				if (m && m[1]) {
					try {
						const obj = JSON.parse(m[1]);
						const user = obj?.graphql?.user || (obj?.entry_data?.ProfilePage && obj.entry_data.ProfilePage[0]?.graphql?.user);
						if (user)
							return {
								followers: user.edge_followed_by?.count ?? null,
								following: user.edge_follow?.count ?? null,
								source: "__additionalDataLoaded",
							};
					} catch (e) {}
				}
			}
		} catch (e) {}
		return null;
	});
}

// DOM-first extraction: anchors and header li
async function extractFromDOM(page) {
	return await page.evaluate(() => {
		const parseNum = (s) => {
			if (!s) return null;
			const t = String(s).replace(/[^\d]/g, "");
			return t ? Number(t) : null;
		};
		function extractFromAnchor(a) {
			try {
				const titleSpan = a.querySelector("span[title]");
				if (titleSpan) {
					const t = titleSpan.getAttribute("title") || titleSpan.innerText || "";
					const n = String(t).replace(/[^\d]/g, "");
					if (n) return Number(n);
				}
				const inner = a.innerText || a.textContent || "";
				const m = inner.match(/([\d.,]+)/);
				if (m) return parseNum(m[1]);
			} catch (e) {}
			return null;
		}

		const anchors = Array.from(document.querySelectorAll("a[href]"));
		let followers = null,
			following = null;
		for (const a of anchors) {
			const href = a.getAttribute("href") || "";
			if (/\/followers\/?$/.test(href) && followers === null) followers = extractFromAnchor(a);
			if (/\/following\/?$/.test(href) && following === null) following = extractFromAnchor(a);
			if (followers !== null && following !== null) break;
		}

		if ((followers === null || following === null) && document.querySelector("header")) {
			const header = document.querySelector("header");
			const lis = Array.from(header.querySelectorAll("li")).map((li) => li.innerText || li.textContent || "");
			for (const text of lis) {
				if (followers === null && /followers|читачі|підписни|подписчики/i.test(text)) {
					const m = text.match(/([\d.,]+)/);
					if (m) followers = parseNum(m[1]);
				}
				if (following === null && /following|стежить|підписки|підписани|подписки/i.test(text)) {
					const m = text.match(/([\d.,]+)/);
					if (m) following = parseNum(m[1]);
				}
			}
		}

		return { followers, following };
	});
}

async function fetchCountsWithBrowser(browser, url) {
	const page = await browser.newPage();
	let requestHandler = null;
	try {
		await page.setUserAgent(USER_AGENT);
		await page.setExtraHTTPHeaders({ "accept-language": "en-US,en;q=0.9" });
		// PASS A: no blocking - try inline JSON / meta
		try {
			await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT }).catch(() => null);
		} catch (e) {}
		// small pause
		await sleep(300);

		const inline = await extractInlineJSON(page);
		if (inline && (inline.followers !== null || inline.following !== null)) {
			await page.close();
			return Object.assign({ url }, inline);
		}
		// try meta as quick fallback
		const meta = await page.$eval('meta[name="description"]', (el) => el.getAttribute("content")).catch(() => null);
		if (meta) {
			const f = (meta.match(/([\d.,]+)\s*Followers?/i) || [])[1] || null;
			const g = (meta.match(/([\d.,]+)\s*Following/i) || [])[1] || null;
			if (f || g) {
				await page.close();
				return { url, followers: f ? parseNumber(f) : null, following: g ? parseNumber(g) : null, source: "meta-first" };
			}
		}

		// PASS B: enable request interception (block heavy resources) and reload for DOM-first
		await page.setRequestInterception(true);
		requestHandler = (req) => {
			const rt = req.resourceType ? req.resourceType() : "";
			const rurl = req.url();
			if (["image", "stylesheet", "font", "media"].includes(rt)) return req.abort();
			if (/doubleclick|google-analytics|facebook|adsystem|gstatic|clarity|hotjar|googlesyndication/i.test(rurl)) return req.abort();
			req.continue();
		};
		page.on("request", requestHandler);

		// reload/navigate again
		try {
			await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT }).catch(() => null);
		} catch (e) {}
		// small wait to let dynamic render update
		await sleep(PASS_B_WAIT_MS);

		const dom = await extractFromDOM(page);
		// cleanup listener
		try {
			page.removeListener("request", requestHandler);
		} catch (e) {}
		await page.setRequestInterception(false);

		await page.close();
		if (dom && (dom.followers !== null || dom.following !== null)) return Object.assign({ url }, dom, { source: "dom-second" });
		return { url, followers: null, following: null, source: "none" };
	} catch (err) {
		try {
			if (requestHandler) page.removeListener("request", requestHandler);
		} catch (e) {}
		try {
			await page.close();
		} catch (e) {}
		return { url, error: String(err) };
	}
}

function printResult(result) {
	console.log(JSON.stringify(result));
}

async function main(urls) {
	// fast path for each url
	const fastResults = {};
	for (const u of urls) {
		const fast = await fastHtmlTry(u);
		if (fast) fastResults[u] = fast;
	}

	// need browser for those that failed fast-path
	const toProcess = urls.filter((u) => !fastResults[u]);
	if (toProcess.length === 0) {
		// just print fast results
		for (const u of urls) printResult(fastResults[u]);
		return;
	}

	// launch single browser (optionally with proxy)
	const chromeExec = findChromeExecutable();
	const launchOptions = {
		headless: HEADLESS,
		args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
		...(chromeExec ? { executablePath: chromeExec } : {}),
	};
	if (PROXY) launchOptions.args.push(`--proxy-server=${PROXY}`);

	let browser;
	try {
		browser = await puppeteer.launch(launchOptions);
	} catch (e) {
		// browser launch failed: fallback to HTTP fast results and error for others
		for (const u of urls) {
			if (fastResults[u]) printResult(fastResults[u]);
			else printResult({ url: u, error: "browser launch failed: " + String(e) });
		}
		return;
	}

	// process those URLs sequentially (or you can parallelize by Promise.all with caution)
	for (const u of urls) {
		if (fastResults[u]) {
			printResult(fastResults[u]);
			continue;
		}
		const res = await fetchCountsWithBrowser(browser, u);
		printResult(res);
	}

	await browser.close();
}

// CLI
(async () => {
	const args = process.argv.slice(2);
	if (!args.length) {
		console.log("Usage: node inst_counts_single_worker.js <url1> <url2> ...");
		process.exit(1);
	}
	await main(args);
})();

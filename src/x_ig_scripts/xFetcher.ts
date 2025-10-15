import fs from "fs";
import path from "path";
import { HTTPResponse, Page, CookieParam } from "puppeteer";

import { runWithPage } from "./browserManager";
import type { SocialCounts } from "../services/socialVerification";

const X_COOKIES_PATH = path.join(__dirname, "x_cookies.json");
const X_USER_AGENT =
	process.env.X_USER_AGENT || "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type Counts = { followers: number | null; following: number | null };

function loadCookies(): CookieParam[] {
	if (!fs.existsSync(X_COOKIES_PATH)) {
		return [];
	}
	try {
		const raw = JSON.parse(fs.readFileSync(X_COOKIES_PATH, "utf8")) as unknown;
		if (!Array.isArray(raw)) {
			return [];
		}
		return raw.filter((item): item is CookieParam => Boolean((item as CookieParam).name && (item as CookieParam).value));
	} catch (error) {
		console.error("[xFetcher] failed to load cookies", {
			path: X_COOKIES_PATH,
			error,
		});
		return [];
	}
}

function parseCount(value: unknown): number | null {
	if (typeof value === "number") {
		return Math.round(value);
	}
	if (value === null || value === undefined) {
		return null;
	}
	const clean = String(value).replace(/,/g, "").trim();
	if (!clean) {
		return null;
	}
	const match = clean.match(/^([\d.]+)\s*([MK])?$/i);
	if (match) {
		const base = parseFloat(match[1]);
		if (!Number.isFinite(base)) {
			return null;
		}
		const suffix = match[2]?.toUpperCase();
		const multiplier = suffix === "M" ? 1_000_000 : suffix === "K" ? 1_000 : 1;
		return Math.round(base * multiplier);
	}
	const numeric = Number(clean.replace(/[^\d]/g, ""));
	return Number.isFinite(numeric) && /\d/.test(clean) ? numeric : null;
}

function extractCountsFromPayload(payload: unknown): Counts | null {
	if (!payload || typeof payload !== "object") {
		return null;
	}
	const queue: unknown[] = [payload];
	while (queue.length) {
		const current = queue.shift();
		if (!current || typeof current !== "object") {
			continue;
		}
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
			if (value && typeof value === "object") {
				queue.push(value);
			}
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
				if (!response.ok()) {
					return;
				}
				const url = response.url();
				if (!/\/i\/api\/graphql\/.+\/UserByScreenName/.test(url)) {
					return;
				}
				const headers = response.headers() ?? {};
				const contentType = headers["content-type"] || headers["Content-Type"] || "";
				if (!/application\/json/i.test(String(contentType))) {
					return;
				}
				const payload = await response.json().catch(() => null);
				if (!payload) {
					return;
				}
				const counts = extractCountsFromPayload(payload);
				if (!counts) {
					return;
				}
				clearTimeout(timer);
				page.off("response", handler);
				resolve(counts);
			} catch {
				// swallow response errors
			}
		};

		page.on("response", handler);
	});
}

export async function fetchXCounts(url: string): Promise<SocialCounts | undefined> {
	try {
		return await runWithPage(async (page) => {
			await page.setUserAgent(X_USER_AGENT);
			await page.setViewport({ width: 1366, height: 900, deviceScaleFactor: 1 });
			await page.evaluateOnNewDocument(() => {
				// eslint-disable-next-line @typescript-eslint/ban-ts-comment
				// @ts-ignore executed in browser context
				Object.defineProperty(navigator, "webdriver", { get: () => false });
			});

			const cookies = loadCookies();
			if (cookies.length) {
				try {
					await page.setCookie(...cookies);
				} catch (error) {
					console.error("[xFetcher] failed to apply cookies", {
						error,
					});
				}
			}

			const countsPromise = waitForGraphQLCounts(page);
			await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
			const counts = await countsPromise;
			const followers = parseCount(counts.followers);
			const following = parseCount(counts.following);
			return {
				url,
				followers,
				following,
				success: followers !== null && following !== null,
			};
		});
	} catch (error) {
		console.error("[xFetcher] failed to fetch counts", {
			url,
			error,
		});
		return undefined;
	}
}

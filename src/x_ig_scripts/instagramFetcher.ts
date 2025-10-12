import fs from "fs";
import path from "path";
import { CookieParam, HTTPResponse, Page } from "puppeteer";

import { runWithPage } from "./browserManager";
import type { SocialCounts } from "../services/socialVerification";

const IG_COOKIES_PATH = process.env.IG_COOKIES_PATH || path.join(__dirname, "inst_cookies.json");
const IG_USER_AGENT =
	process.env.IG_USER_AGENT ||
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface GraphQLCounts {
	followers: number | null;
	following: number | null;
}

function loadCookies(): CookieParam[] {
	if (!fs.existsSync(IG_COOKIES_PATH)) {
		return [];
	}
	try {
		const raw = JSON.parse(fs.readFileSync(IG_COOKIES_PATH, "utf8"));
		if (!Array.isArray(raw)) {
			return [];
		}
		return raw
			.map((cookie: Record<string, unknown>) => {
				if (typeof cookie.name !== "string" || typeof cookie.value !== "string") {
					return null;
				}
				const normalized: CookieParam = {
					name: cookie.name,
					value: cookie.value,
					path: typeof cookie.path === "string" ? cookie.path : "/",
					domain: typeof cookie.domain === "string" ? cookie.domain.replace(/^\./, "") : "instagram.com",
				};
				if (typeof cookie.secure === "boolean") {
					normalized.secure = cookie.secure;
				}
				if (typeof cookie.httpOnly === "boolean") {
					normalized.httpOnly = cookie.httpOnly;
				}
				if (typeof cookie.expirationDate === "number") {
					normalized.expires = Math.round(cookie.expirationDate);
				}
				const sameSiteMap: Record<string, CookieParam["sameSite"]> = {
					lax: "Lax",
					strict: "Strict",
					none: "None",
					no_restriction: "None",
				};
				if (typeof cookie.sameSite === "string") {
					const key = cookie.sameSite.toLowerCase();
					if (sameSiteMap[key]) {
						normalized.sameSite = sameSiteMap[key];
					}
				}
				const scheme = normalized.secure ? "https" : "http";
				if (normalized.domain) {
					normalized.url = `${scheme}://${normalized.domain}`;
				}
				return normalized;
			})
			.filter((cookie): cookie is CookieParam => cookie !== null);
	} catch (error) {
		console.error("[instagramFetcher] failed to load cookies", {
			path: IG_COOKIES_PATH,
			error,
		});
		return [];
	}
}

function extractCountsFromPayload(payload: unknown): GraphQLCounts | null {
	if (!payload || typeof payload !== "object") {
		return null;
	}
	const queue: unknown[] = [payload];
	while (queue.length > 0) {
		const node = queue.shift();
		if (!node || typeof node !== "object") {
			continue;
		}
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
		for (const value of Object.values(record)) {
			if (value && typeof value === "object") {
				queue.push(value);
			}
		}
	}
	return null;
}

function waitForGraphQLCounts(page: Page, timeoutMs = 30_000): Promise<GraphQLCounts> {
	return new Promise<GraphQLCounts>((resolve, reject) => {
		const timer = setTimeout(() => {
			page.off("response", handleResponse);
			reject(new Error("Follower/following counts not found."));
		}, timeoutMs);

		const handleResponse = async (response: HTTPResponse) => {
			try {
				if (!response.ok()) {
					return;
				}
				const url = response.url();
				if (!/\/graphql\/query/i.test(url)) {
					return;
				}
				const headers = response.headers() || {};
				const contentType = headers["content-type"] || headers["Content-Type"] || "";
				if (typeof contentType === "string" && !/json/i.test(contentType)) {
					return;
				}
				const text = await response.text();
				if (!text) {
					return;
				}
				let payload: unknown;
				try {
					payload = JSON.parse(text);
				} catch {
					return;
				}
				const counts = extractCountsFromPayload(payload);
				if (!counts) {
					return;
				}
				clearTimeout(timer);
				page.off("response", handleResponse);
				resolve(counts);
			} catch {
				// ignore errors per response
			}
		};

		page.on("response", handleResponse);
	});
}

function parseCount(value: number | string | null | undefined): number {
	if (typeof value === "number") {
		return value;
	}
	if (value === null || value === undefined) {
		return 0;
	}
	const raw = String(value).trim();
	if (!raw) {
		return 0;
	}

	const suffixMatch = raw.match(/([KMB])$/i);
	const suffix = suffixMatch ? suffixMatch[1].toUpperCase() : null;
	const numberPart = suffix ? raw.slice(0, -1) : raw;
	const cleaned = numberPart.replace(/[\s,\u202f]/g, "");
	const num = Number.parseFloat(cleaned);
	if (Number.isNaN(num)) {
		return 0;
	}

	if (!suffix) return Math.round(num);
	if (suffix === "K") return Math.round(num * 1_000);
	if (suffix === "M") return Math.round(num * 1_000_000);
	if (suffix === "B") return Math.round(num * 1_000_000_000);
	return Math.round(num);
}

export async function fetchInstagramCounts(url: string): Promise<SocialCounts | undefined> {
	try {
		return await runWithPage(async (page) => {
			await page.setUserAgent(IG_USER_AGENT);
			await page.setExtraHTTPHeaders({ "accept-language": "en-US,en;q=0.9" });
			await page.setViewport({ width: 1280, height: 720 });

			const cookies = loadCookies();
			if (cookies.length) {
				try {
					await page.setCookie(...cookies);
				} catch (error) {
					console.error("[instagramFetcher] failed to apply cookies", {
						error,
					});
				}
			}

			await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
			const counts = await waitForGraphQLCounts(page);
			const followers = parseCount(counts.followers);
			const following = parseCount(counts.following);

			return {
				url,
				followers,
				following,
				success: followers > 0 || following > 0,
			};
		});
	} catch (error) {
		console.error("[instagramFetcher] failed to fetch counts", {
			url,
			error,
		});
		return undefined;
	}
}


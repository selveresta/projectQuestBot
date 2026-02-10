import type { BotContext } from "../../types/context";

export const WHITELIST_SUBSCRIPTIONS_KEY = "whiteListSubs";
export const WHITELIST_JOIN_CALLBACK = "whitelist:join";

const WHITELIST_PENDING_PREFIX = "pending_whitelist_email:";
const WHITELIST_PENDING_TTL_SECONDS = 900;

function pendingWhitelistEmailKey(userId: number): string {
	return `${WHITELIST_PENDING_PREFIX}${userId}`;
}

export async function beginWhitelistEmailCapture(ctx: BotContext, userId: number): Promise<void> {
	await ctx.services.redis.set(pendingWhitelistEmailKey(userId), "1", { EX: WHITELIST_PENDING_TTL_SECONDS });
}

export async function isAwaitingWhitelistEmail(ctx: BotContext, userId: number): Promise<boolean> {
	const marker = await ctx.services.redis.get(pendingWhitelistEmailKey(userId));
	return marker === "1";
}

export async function finishWhitelistEmailCapture(ctx: BotContext, userId: number): Promise<void> {
	await ctx.services.redis.del(pendingWhitelistEmailKey(userId));
}

export function isValidWhitelistEmail(input: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
}

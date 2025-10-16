import type { AppConfig } from "../../config";
import type { BotContext } from "../../types/context";
import type { QuestService } from "../../services/questService";
import type { QuestId } from "../../types/quest";
import type { UserRecord } from "../../types/user";
import { captureSocialBaseline, type SocialPlatform, type SocialVerificationBaseline } from "../../services/socialVerification";
import { buildMainMenuKeyboard } from "../ui/replyKeyboards";

export const SOCIAL_QUEST_IDS = ["x_follow", "instagram_follow"] as const;
export type SocialQuestId = (typeof SOCIAL_QUEST_IDS)[number];

const SOCIAL_PLATFORM_MAP: Record<SocialQuestId, SocialPlatform> = {
	x_follow: "x",
	instagram_follow: "instagram",
};

interface SocialQuestConfig {
	field: "xProfileUrl" | "instagramProfileUrl" | "discordUserId";
	promptPrefix: string;
	sampleUrl: string;
	allowedDomains: string[];
	invalidMessage: string;
	successMessage: string;
}

const SOCIAL_QUESTS: Record<SocialQuestId, SocialQuestConfig> = {
	x_follow: {
		field: "xProfileUrl",
		promptPrefix: "🔗 Share your X profile link.",
		sampleUrl: "https://x.com/yourhandle",
		allowedDomains: ["x.com", "twitter.com"],
		invalidMessage: "Please send the link to your X profile (for example: https://x.com/yourhandle).",
		successMessage: "✅ X profile saved.",
	},
	instagram_follow: {
		field: "instagramProfileUrl",
		promptPrefix: "📸 Share your Instagram profile link.",
		sampleUrl: "https://instagram.com/yourhandle",
		allowedDomains: ["instagram.com"],
		invalidMessage: "Please send the link to your Instagram profile (for example: https://instagram.com/yourhandle).",
		successMessage: "✅ Instagram profile saved.",
	},
	// discord_join: {
	// 	field: "discordUserId",
	// 	promptPrefix: "📸 Share your Discord user ID.",
	// 	sampleUrl: "272413599446597632",
	// 	allowedDomains: ["discord.com"],
	// 	invalidMessage: "Please send the ID to your Discord user (for example: 272413599446597632).",
	// 	successMessage: "✅ Discord user saved.",
	// },
};

export function isSocialQuestId(questId: QuestId): questId is SocialQuestId {
	return (SOCIAL_QUEST_IDS as ReadonlyArray<string>).includes(questId);
}

export function getSocialQuestConfig(questId: SocialQuestId): SocialQuestConfig {
	return SOCIAL_QUESTS[questId];
}

export function getSocialPlatform(questId: SocialQuestId): SocialPlatform {
	return SOCIAL_PLATFORM_MAP[questId];
}

export function getSocialTargetUrl(config: AppConfig, questId: SocialQuestId): string | undefined {
	if (questId === "x_follow") {
		return config.links.xProfileUrl || undefined;
	}
	if (questId === "instagram_follow") {
		return config.links.instagramProfileUrl || undefined;
	}
	if (questId === "discord_join") {
		return config.links.discordInviteUrl || undefined;
	}
	return undefined;
}

export function getExistingSocialUrl(user: UserRecord, questId: SocialQuestId): string | undefined {
	const config = getSocialQuestConfig(questId);
	return user[config.field];
}

function pendingSocialQuestKey(userId: number): string {
	return `pending_social_quest:${userId}`;
}

const SOCIAL_BASELINE_TTL_SECONDS = 900;
const SOCIAL_BASELINE_PENDING_TTL_SECONDS = 120;

function socialBaselineKey(userId: number, questId: SocialQuestId): string {
	return `social_baseline:${userId}:${questId}`;
}

function socialBaselinePendingKey(userId: number, questId: SocialQuestId): string {
	return `social_baseline_pending:${userId}:${questId}`;
}

async function setPendingSocialQuest(ctx: BotContext, questId: SocialQuestId): Promise<void> {
	const userId = ctx.from?.id;
	if (!userId) {
		return;
	}
	await ctx.services.redis.set(pendingSocialQuestKey(userId), questId, { EX: 600 });
}

async function getPendingSocialQuest(ctx: BotContext): Promise<SocialQuestId | undefined> {
	const userId = ctx.from?.id;
	if (!userId) {
		return undefined;
	}
	const raw = await ctx.services.redis.get(pendingSocialQuestKey(userId));
	if (!raw) {
		return undefined;
	}
	if ((SOCIAL_QUEST_IDS as ReadonlyArray<string>).includes(raw)) {
		return raw as SocialQuestId;
	}
	return undefined;
}

export async function clearPendingSocialQuest(ctx: BotContext): Promise<void> {
	const userId = ctx.from?.id;
	if (!userId) {
		return;
	}
	await ctx.services.redis.del(pendingSocialQuestKey(userId));
}

export async function getSocialBaseline(
	ctx: BotContext,
	userId: number,
	questId: SocialQuestId
): Promise<SocialVerificationBaseline | undefined> {
	const raw = await ctx.services.redis.get(socialBaselineKey(userId, questId));
	if (!raw) {
		return undefined;
	}
	try {
		return JSON.parse(raw) as SocialVerificationBaseline;
	} catch (error) {
		console.error("[socialBaseline] failed to parse stored baseline", { userId, questId, error });
		await ctx.services.redis.del(socialBaselineKey(userId, questId));
		return undefined;
	}
}

export async function clearSocialBaseline(ctx: BotContext, userId: number, questId: SocialQuestId): Promise<void> {
	await ctx.services.redis.del(socialBaselineKey(userId, questId));
	await clearBaselinePending(ctx, userId, questId);
}

async function markBaselinePending(ctx: BotContext, userId: number, questId: SocialQuestId): Promise<void> {
	await ctx.services.redis.set(socialBaselinePendingKey(userId, questId), "1", {
		EX: SOCIAL_BASELINE_PENDING_TTL_SECONDS,
	});
}

export async function clearBaselinePending(ctx: BotContext, userId: number, questId: SocialQuestId): Promise<void> {
	await ctx.services.redis.del(socialBaselinePendingKey(userId, questId));
}

export async function isBaselinePending(ctx: BotContext, userId: number, questId: SocialQuestId): Promise<boolean> {
	const value = await ctx.services.redis.get(socialBaselinePendingKey(userId, questId));
	return value === "1";
}

export async function ensureSocialBaseline(
	ctx: BotContext,
	userId: number,
	questId: SocialQuestId,
	userUrl: string
): Promise<SocialVerificationBaseline | undefined> {
	// if (questId === "discord_join") {
	// 	return undefined;
	// }

	const existing = await getSocialBaseline(ctx, userId, questId);
	if (existing) {
		return existing;
	}

	const targetUrl = getSocialTargetUrl(ctx.config, questId);
	if (!targetUrl) {
		return undefined;
	}

	const platform = getSocialPlatform(questId);
	await markBaselinePending(ctx, userId, questId);
	try {
		const baseline = await captureSocialBaseline({
			platform,
			userUrl,
			targetUrl,
		});
		if (baseline) {
			await ctx.services.redis.set(socialBaselineKey(userId, questId), JSON.stringify(baseline), {
				EX: SOCIAL_BASELINE_TTL_SECONDS,
			});
			return baseline;
		}
	} catch (error) {
		console.error("[socialBaseline] capture failed", { userId, questId, error });
	} finally {
		await clearBaselinePending(ctx, userId, questId);
	}

	return getSocialBaseline(ctx, userId, questId);
}

export async function promptForSocialProfile(ctx: BotContext, questId: SocialQuestId, existing?: string): Promise<void> {
	const config = getSocialQuestConfig(questId);
	const instructions = `Reply with the full URL \n(for example: ${config.sampleUrl}).`;
	const lines = [config.promptPrefix, existing ? `Current submission: ${existing}` : undefined, instructions].filter(Boolean);

	await setPendingSocialQuest(ctx, questId);
	await ctx.reply(lines.join("\n"), {
		reply_markup: buildMainMenuKeyboard(ctx.config, ctx.chatId),
		link_preview_options: { is_disabled: true },
	});
}

function identifySocialQuestFromReply(ctx: BotContext): SocialQuestId | undefined {
	const reply = ctx.message?.reply_to_message;
	if (!reply?.text || reply.from?.id !== ctx.me?.id) {
		return undefined;
	}

	const replyText = reply.text;
	return SOCIAL_QUEST_IDS.find((questId) => replyText.startsWith(SOCIAL_QUESTS[questId].promptPrefix));
}

function looksLikeDiscordId(input: string): boolean {
	return /^\d{5,25}$/.test(input);
}

export async function identifySocialQuestFromMessage(ctx: BotContext): Promise<SocialQuestId | undefined> {
	const viaReply = identifySocialQuestFromReply(ctx);
	if (viaReply) {
		return viaReply;
	}

	const text = ctx.message?.text?.trim() ?? "";
	if (!text) {
		return getPendingSocialQuest(ctx);
	}

	for (const questId of SOCIAL_QUEST_IDS) {
		if (isValidSocialProfileInput(text, questId)) {
			return questId;
		}
	}

	if (!text.startsWith("/")) {
		const pending = await getPendingSocialQuest(ctx);
		if (pending) {
			return pending;
		}
	}

	return undefined;
}

export function isValidSocialProfileInput(input: string, questId: SocialQuestId): boolean {
	try {
		const url = new URL(input);
		if (!["http:", "https:"].includes(url.protocol)) {
			return false;
		}
		const hostname = url.hostname.toLowerCase();
		const normalizedHost = hostname.startsWith("www.") ? hostname.slice(4) : hostname;
		const config = getSocialQuestConfig(questId);
		if (!config.allowedDomains.includes(normalizedHost)) {
			return false;
		}
		const pathname = url.pathname.replace(/\/+$/, "");
		return pathname.length > 1;
	} catch {
		return false;
	}
}

export function normalizeSocialProfileInput(input: string, questId: SocialQuestId): string {
	const url = new URL(input);
	url.protocol = "https:";
	url.hash = "";
	url.search = "";
	if (url.hostname.startsWith("www.")) {
		url.hostname = url.hostname.slice(4);
	}
	url.pathname = url.pathname.replace(/\/+$/, "");
	return url.toString();
}

export async function saveSocialProfile(
	questService: QuestService,
	userId: number,
	questId: SocialQuestId,
	normalizedUrl: string
): Promise<void> {
	const config = getSocialQuestConfig(questId);
	const contact = {
		[config.field]: normalizedUrl,
	} as Partial<Pick<UserRecord, "xProfileUrl" | "instagramProfileUrl" | "discordUserId">>;
	await questService.updateContact(userId, contact);
	await questService.saveQuestMetadata(userId, questId, normalizedUrl);
}

export function getSocialSuccessMessage(questId: SocialQuestId): string {
	return getSocialQuestConfig(questId).successMessage;
}

export function getSocialInvalidMessage(questId: SocialQuestId): string {
	return getSocialQuestConfig(questId).invalidMessage;
}

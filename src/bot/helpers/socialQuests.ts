import type { BotContext } from "../../types/context";
import type { QuestService } from "../../services/questService";
import type { QuestId } from "../../types/quest";
import type { UserRecord } from "../../types/user";

export const SOCIAL_QUEST_IDS = ["x_follow", "instagram_follow"] as const;
export type SocialQuestId = (typeof SOCIAL_QUEST_IDS)[number];

interface SocialQuestConfig {
	field: "xProfileUrl" | "instagramProfileUrl";
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
		invalidMessage:
			"Please send the link to your X profile (for example: https://x.com/yourhandle).",
		successMessage: "✅ X profile saved. Run /status to confirm it has been recorded.",
	},
	instagram_follow: {
		field: "instagramProfileUrl",
		promptPrefix: "📸 Share your Instagram profile link.",
		sampleUrl: "https://instagram.com/yourhandle",
		allowedDomains: ["instagram.com"],
		invalidMessage:
			"Please send the link to your Instagram profile (for example: https://instagram.com/yourhandle).",
		successMessage:
			"✅ Instagram profile saved. Run /status to confirm it has been recorded.",
	},
};

export function isSocialQuestId(questId: QuestId): questId is SocialQuestId {
	return (SOCIAL_QUEST_IDS as ReadonlyArray<string>).includes(questId);
}

export function getSocialQuestConfig(questId: SocialQuestId): SocialQuestConfig {
	return SOCIAL_QUESTS[questId];
}

export function getExistingSocialUrl(user: UserRecord, questId: SocialQuestId): string | undefined {
	const config = getSocialQuestConfig(questId);
	return user[config.field];
}

export async function promptForSocialProfile(
	ctx: BotContext,
	questId: SocialQuestId,
	existing?: string
): Promise<void> {
	const config = getSocialQuestConfig(questId);
	const lines = [
		config.promptPrefix,
		existing ? `Current submission: ${existing}` : undefined,
		`Reply with the full URL (for example: ${config.sampleUrl}).`,
	].filter(Boolean);

	await ctx.reply(lines.join("\n"), {
		reply_markup: { force_reply: true, selective: true },
	});
}

export function identifySocialQuestFromReply(ctx: BotContext): SocialQuestId | undefined {
	const reply = ctx.message?.reply_to_message;
	if (!reply?.text || reply.from?.id !== ctx.me?.id) {
		return undefined;
	}

	const replyText = reply.text;
	return SOCIAL_QUEST_IDS.find((questId) =>
		replyText.startsWith(SOCIAL_QUESTS[questId].promptPrefix)
	);
}

export function isValidSocialProfileUrl(input: string, questId: SocialQuestId): boolean {
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

export function normalizeSocialProfileUrl(input: string): string {
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
	} as Partial<Pick<UserRecord, "xProfileUrl" | "instagramProfileUrl">>;
	await questService.updateContact(userId, contact);
	await questService.completeQuest(userId, questId, normalizedUrl);
}

export function getSocialSuccessMessage(questId: SocialQuestId): string {
	return getSocialQuestConfig(questId).successMessage;
}

export function getSocialInvalidMessage(questId: SocialQuestId): string {
	return getSocialQuestConfig(questId).invalidMessage;
}

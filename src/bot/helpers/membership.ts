import type { ChatMember } from "grammy/types";

import type { BotContext } from "../../types/context";

const ALLOWED_MEMBER_STATUSES: ChatMember["status"][] = ["administrator", "creator", "member"];

export async function ensureTelegramMembership(ctx: BotContext): Promise<boolean> {
	const targetChat = ctx.config.requiredChannelId;
	if (!targetChat) {
		return true;
	}

	const userId = ctx.from?.id;
	if (!userId) {
		await ctx.reply("Unable to verify your Telegram account. Please try again.");
		return false;
	}

	try {
		const membership = await ctx.api.getChatMember(targetChat, userId);
		if (!ALLOWED_MEMBER_STATUSES.includes(membership.status)) {
			await ctx.reply("You need to join the Telegram channel before continuing with the giveaway.");
			return false;
		}

		await ctx.services.questService.syncTelegramMembership(userId);
		return true;
	} catch (error) {
		console.error("[membership] membership lookup failed", error);
		await ctx.reply(
			"I could not verify your Telegram membership right now. Please make sure you joined the channel and try again shortly."
		);
		return false;
	}
}

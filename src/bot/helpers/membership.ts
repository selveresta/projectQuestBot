import type { ChatMember } from "grammy/types";

import type { BotContext } from "../../types/context";
import type { QuestId } from "../../types/quest";
import { notifyReferralReward } from "./referrals";

const ALLOWED_MEMBER_STATUSES: ChatMember["status"][] = ["administrator", "creator", "member"];

export type TelegramMembershipTarget = "channel" | "chat";

interface MembershipDescriptor {
	questId: QuestId;
	chatId: string;
	joinUrl?: string;
	successLabel: string;
	failureMessage: string;
}

export class TelegramMembershipVerifier {
	static async ensure(ctx: BotContext, target: TelegramMembershipTarget): Promise<boolean> {
		const descriptor = TelegramMembershipVerifier.resolveDescriptor(ctx, target);
		if (!descriptor) {
			return true;
		}

		const userId = ctx.from?.id;
		if (!userId) {
			await ctx.reply("Unable to verify your Telegram account. Please try again.");
			return false;
		}

		const questService = ctx.services.questService;
		const alreadyCompleted = await questService.hasCompletedQuest(userId, descriptor.questId);

		try {
			const membership = await ctx.api.getChatMember(descriptor.chatId, userId);
			if (!ALLOWED_MEMBER_STATUSES.includes(membership.status)) {
				const linkHint = descriptor.joinUrl ? `\n${descriptor.joinUrl}` : "";
				await ctx.reply(`${descriptor.failureMessage}${linkHint}`);
				return false;
			}

                        if (!alreadyCompleted) {
                                const completion = await questService.completeQuest(userId, descriptor.questId);
                                await notifyReferralReward(ctx, completion.referralReward);
                                await ctx.reply(`✅ ${descriptor.successLabel} confirmed.`);
                        }

			return true;
		} catch (error) {
			console.error("[membership] membership lookup failed", { target, error });
			await ctx.reply("Telegram is not responding right now. Make sure you joined and try again in a moment.");
			return false;
		}
	}

	private static resolveDescriptor(ctx: BotContext, target: TelegramMembershipTarget): MembershipDescriptor | null {
		if (target === "channel") {
			const { channelId, channelUrl } = ctx.config.telegram;
			if (!channelId) {
				return null;
			}
			return {
				questId: "telegram_channel",
				chatId: channelId,
				joinUrl: channelUrl || undefined,
				successLabel: "Telegram channel subscription",
				failureMessage: "Please join the announcement channel before continuing.",
			};
		}

		const { chatId, chatUrl } = ctx.config.telegram;
		if (!chatId) {
			return null;
		}
		return {
			questId: "telegram_chat",
			chatId,
			joinUrl: chatUrl || undefined,
			successLabel: "Telegram community chat membership",
			failureMessage: "Please join the community chat before continuing.",
		};
	}
}

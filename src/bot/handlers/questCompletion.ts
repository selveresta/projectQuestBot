import { Composer, InlineKeyboard } from "grammy";

import type { BotContext } from "../../types/context";
import type { QuestDefinition, QuestId } from "../../types/quest";
import {
	getExistingSocialUrl,
	getSocialInvalidMessage,
	getSocialSuccessMessage,
	identifySocialQuestFromReply,
	isSocialQuestId,
	isValidSocialProfileUrl,
	normalizeSocialProfileUrl,
	promptForSocialProfile,
	saveSocialProfile,
} from "../helpers/socialQuests";

export class StubQuestHandler {
	register(composer: Composer<BotContext>): void {
		composer.callbackQuery(/^quest:(.+):complete$/, this.handleStubCompletion.bind(this));
		composer.on("message:text", this.handleTextResponse.bind(this));
	}

	buildKeyboard(definitions: QuestDefinition[], pendingQuestIds: QuestId[]): InlineKeyboard | undefined {
		if (pendingQuestIds.length === 0) {
			return undefined;
		}

		const stubDefinitions = definitions.filter(
			(quest) => quest.phase === "stub" && pendingQuestIds.includes(quest.id)
		);

		if (stubDefinitions.length === 0) {
			return undefined;
		}

		const keyboard = new InlineKeyboard();
		stubDefinitions.forEach((quest, index) => {
			keyboard.text(`✅ ${quest.title}`, `quest:${quest.id}:complete`);
			if ((index + 1) % 2 === 0) {
				keyboard.row();
			}
		});
		return keyboard;
	}

	private async handleStubCompletion(ctx: BotContext): Promise<void> {
		const questId = ctx.match?.[1] as QuestId | undefined;
		if (!questId) {
			await ctx.answerCallbackQuery({ text: "Unknown quest." });
			return;
		}

		const questService = ctx.services.questService;
		const quest = questService.getDefinition(questId);
		if (!quest || quest.phase !== "stub") {
			await ctx.answerCallbackQuery({
				text: "This quest requires automated verification (Phase 2).",
				show_alert: true,
			});
			return;
		}

		if (isSocialQuestId(questId)) {
			const userId = ctx.from?.id;
			if (!userId) {
				await ctx.answerCallbackQuery({
					text: "Could not resolve your Telegram ID.",
					show_alert: true,
				});
				return;
			}

			const user = await questService.getUser(userId);
			const existing = getExistingSocialUrl(user, questId);
			await ctx.answerCallbackQuery({
				text: existing
					? "Reply with your profile link to update it."
					: "Reply with your profile link so we can record it.",
				show_alert: false,
			});
			await promptForSocialProfile(ctx, questId, existing);
			return;
		}

		const userId = ctx.from?.id;
		if (!userId) {
			await ctx.answerCallbackQuery({
				text: "Could not resolve your Telegram ID.",
				show_alert: true,
			});
			return;
		}

		const alreadyCompleted = await questService.hasCompletedQuest(userId, questId);
		if (alreadyCompleted) {
			await ctx.answerCallbackQuery({ text: "Already marked as complete." });
			return;
		}

		await questService.completeQuest(userId, questId);
		await ctx.answerCallbackQuery({
			text: `${quest.title} marked as complete.`,
			show_alert: false,
		});

		await ctx.editMessageText("Quest recorded. Run /status to check your updated progress.");
	}

	private async handleTextResponse(ctx: BotContext, next: () => Promise<void>): Promise<void> {
		if (!ctx.from) {
			await next();
			return;
		}

		const questId = identifySocialQuestFromReply(ctx);
		if (!questId) {
			await next();
			return;
		}

		const input = ctx.message?.text?.trim() ?? "";
		if (!isValidSocialProfileUrl(input, questId)) {
			await ctx.reply(getSocialInvalidMessage(questId));
			await promptForSocialProfile(ctx, questId);
			return;
		}

		const userId = ctx.from.id;
		const normalized = normalizeSocialProfileUrl(input);
		await saveSocialProfile(ctx.services.questService, userId, questId, normalized);
		await ctx.reply(getSocialSuccessMessage(questId));
	}
}

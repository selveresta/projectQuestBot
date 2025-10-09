import { Composer, InlineKeyboard } from "grammy";

import type { BotContext } from "../../types/context";
import { QUEST_DEFINITIONS, type QuestDefinition, type QuestId } from "../../types/quest";

function getStubQuests(): QuestDefinition[] {
	return QUEST_DEFINITIONS.filter((quest) => quest.phase === "stub");
}

export function buildStubQuestKeyboard(pendingQuestIds: QuestId[]): InlineKeyboard | undefined {
	if (pendingQuestIds.length === 0) {
		return undefined;
	}

	const stubDefinitions = getStubQuests().filter((quest) => pendingQuestIds.includes(quest.id));

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

export function registerQuestCompletionHandlers(composer: Composer<BotContext>): void {
	composer.callbackQuery(/^quest:(.+):complete$/, async (ctx) => {
		const questId = ctx.match?.[1] as QuestId | undefined;
		if (!questId) {
			await ctx.answerCallbackQuery({ text: "Unknown quest." });
			return;
		}

		const quest = QUEST_DEFINITIONS.find((item) => item.id === questId);
		if (!quest || quest.phase !== "stub") {
			await ctx.answerCallbackQuery({
				text: "This quest requires automated verification (Phase 2).",
				show_alert: true,
			});
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

		const questService = ctx.services.questService;
		const user = await questService.getUser(userId);
		const alreadyCompleted = user.quests[questId]?.completed;
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
	});
}

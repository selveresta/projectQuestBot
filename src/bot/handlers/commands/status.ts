import { Composer } from "grammy";

import type { BotContext } from "../../../types/context";
import type { QuestId } from "../../../types/quest";
import { buildMainMenuKeyboard, BUTTON_CHECK_STATUS } from "../../ui/replyKeyboards";
import { buildStubQuestKeyboard } from "../questCompletion";

async function replyWithStatus(ctx: BotContext): Promise<void> {
	if (!ctx.from) {
		await ctx.reply("I need a Telegram user to check status.");
		return;
	}

	const userId = ctx.from.id;
	const repo = ctx.services.userRepository;
	const questService = ctx.services.questService;

	const user = await repo.getOrCreate(userId, {
		username: ctx.from.username,
		firstName: ctx.from.first_name,
		lastName: ctx.from.last_name,
	});

	const quests = await questService.buildQuestStatus(userId);
	const eligible = questService.isUserEligible(user);

	const questLines = quests.map((item) => {
		const status = item.completed ? "✅" : "⏳";
		const suffix = item.definition.phase === "stub" && !item.completed ? " — verification will arrive in Phase 2" : "";
		return `${status} ${item.definition.title}${suffix}`;
	});

	const metaLines = [
		`Captcha: ${user.captchaPassed ? "✅ passed" : "⏳ pending"}`,
		`Email: ${user.email ?? "not submitted"}`,
		`Wallet: ${user.wallet ?? "not submitted"}`,
	];

	await ctx.reply(
		[
			`Giveaway eligibility: ${eligible ? "✅ Eligible" : "⏳ Pending quests"}`,
			"",
			"Quest progress:",
			...questLines,
			"",
			...metaLines,
			"",
			"Complete every quest to become eligible for the prize pool.",
		].join("\n"),
		{ reply_markup: buildMainMenuKeyboard() }
	);

	const pendingStubQuestIds: QuestId[] = quests
		.filter((item) => item.definition.phase === "stub" && !item.completed)
		.map((item) => item.definition.id as QuestId);

	const keyboard = buildStubQuestKeyboard(pendingStubQuestIds);
	if (keyboard) {
		await ctx.reply("Phase 1 uses trust-based confirmations. Tap the quests you've completed so we can record them:", {
			reply_markup: keyboard,
		});
	}
}

export function registerStatusCommand(composer: Composer<BotContext>): void {
	composer.command("status", replyWithStatus);
	composer.hears(BUTTON_CHECK_STATUS, replyWithStatus);
}

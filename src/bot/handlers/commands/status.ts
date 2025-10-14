import { Composer } from "grammy";

import type { BotContext } from "../../../types/context";
import type { QuestId } from "../../../types/quest";
import { buildMainMenuKeyboard, BUTTON_CHECK_STATUS } from "../../ui/replyKeyboards";
import { StubQuestHandler } from "../questCompletion";

export class StatusCommandHandler {
	constructor(private readonly stubQuestHandler: StubQuestHandler) {}

	register(composer: Composer<BotContext>): void {
		const handler = this.handleStatus.bind(this);
		composer.hears(BUTTON_CHECK_STATUS, handler);
	}

	private async handleStatus(ctx: BotContext): Promise<void> {
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
			return `${status} ${item.definition.title}`;
		});

		const metaLines = [
			`Captcha: ${user.captchaPassed ? "✅ passed" : "⏳ pending"}`,
			`Email: ${user.email ?? "not submitted"}`,
			`Wallet: ${user.wallet ?? "not submitted"}`,
			`X profile: ${user.xProfileUrl ?? "not submitted"}`,
			`Instagram profile: ${user.instagramProfileUrl ?? "not submitted"}`,
			`Discord ID: ${user.discordUserId ?? "not linked"}`,
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
			{ reply_markup: buildMainMenuKeyboard(ctx.config, ctx.chatId), link_preview_options: { is_disabled: true } }
		);
	}
}

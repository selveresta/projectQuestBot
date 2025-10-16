import { Composer, InputFile } from "grammy";

import type { BotContext } from "../../../types/context";
import type { QuestId } from "../../../types/quest";
import { buildMainMenuKeyboard, buildReferralLink, BUTTON_ABOUT, BUTTON_CHECK_STATUS } from "../../ui/replyKeyboards";
import { StubQuestHandler } from "../questCompletion";

export class StatusCommandHandler {
	constructor(private readonly stubQuestHandler: StubQuestHandler) {}

	register(composer: Composer<BotContext>): void {
		const handler = this.handleStatus.bind(this);
		const handlerAbout = this.handleAbout.bind(this);
		composer.hears(BUTTON_CHECK_STATUS, handler);
		composer.hears(BUTTON_ABOUT, handlerAbout);
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

		const referralsCount = user.creditedReferrals?.length ?? 0;
		const metaLines = [
			`Captcha: ${user.captchaPassed ? "✅ passed" : "⏳ pending"}`,
			`Points: ${user.points ?? 0}`,
			`Referrals credited: ${referralsCount}`,
			`Email: ${user.email ?? "not submitted"}`,
			`Wallet (EVM): ${user.wallet ?? "not submitted"}`,
			`Wallet (SOL): ${user.solanaWallet ?? "not submitted"}`,
			`X profile: ${user.xProfileUrl ?? "not submitted"}`,
			`Instagram profile: ${user.instagramProfileUrl ?? "not submitted"}`,
			`Discord ID: ${user.discordUserId ?? "not linked"}`,
			`Referred by: ${user.referredBy ? `user ${user.referredBy}` : "none"}`,
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
			{ reply_markup: buildMainMenuKeyboard(ctx.config, ctx.chatId), link_preview_options: { is_disabled: true }, parse_mode: "HTML" }
		);
	}

	private async handleAbout(ctx: BotContext): Promise<void> {
		if (!ctx.from) {
			await ctx.reply("I need a Telegram user to check status.");
			return;
		}

		await ctx.replyWithPhoto(new InputFile("img/about.png"), {
			caption: `
What is Trady ❓

Trady is the alpha trading terminal for on-chain pros and degens – the only stack you’ll need.

Trade faster, smarter, and fully on your terms:
• All tokens, all supported chains — no listings gatekeeping
• Unified cross-chain balance + multi-wallet control
• Full self-custody — you hold the keys; every tx needs your signature
• Pro tooling — advanced charts, limit/TP/SL, smart alerts, copy & wallet tracking
• Customizable cockpit — hotkeys, widgets, and a layout that fits your flow
• Early token access & degen feeds — catch fresh launches first

🎁 Rewards
Winners receive USDT and Early Access to Trady – where even bigger prizes and exclusive rewards await.
			`,
			reply_markup: buildMainMenuKeyboard(ctx.config, ctx.chatId),
		});
	}
}

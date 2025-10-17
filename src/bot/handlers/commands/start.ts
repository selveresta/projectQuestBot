import { Composer } from "grammy";

import type { BotContext } from "../../../types/context";
import { buildMainMenuKeyboard, MENU_PLACEHOLDER_TEXT } from "../../ui/replyKeyboards";
import { CaptchaHandler } from "../captcha";
import type { UserRecord } from "../../../types/user";

export class StartCommandHandler {
	register(composer: Composer<BotContext>): void {
		composer.command("start", this.handleStart.bind(this));
	}

	private async handleStart(ctx: BotContext): Promise<void> {
		if (!ctx.from) {
			await ctx.reply("I can only chat with real Telegram users.");
			return;
		}

		const userId = ctx.from.id;
		const repo = ctx.services.userRepository;
		const referralId = this.extractReferralId(ctx);
		const existingUser = await repo.get(userId);

		if (referralId && referralId === userId) {
			await ctx.reply("You cannot use your own referral link.");
		}

		if (referralId && referralId !== userId && existingUser?.captchaPassed) {
			await ctx.reply("You are already registered and cannot use a referral link again.");
			await this.showMainMenu(ctx, existingUser);
			return;
		}

		if (referralId && referralId !== userId) {
			await repo.assignReferrer(userId, referralId);
		}

		const user = await repo.getOrCreate(userId, {
			username: ctx.from.username,
			firstName: ctx.from.first_name,
			lastName: ctx.from.last_name,
			referredBy: referralId && referralId !== userId ? referralId : undefined,
		});

		if (!user.captchaPassed) {
			await this.promptCaptcha(ctx, userId);
			return;
		}

		await this.showMainMenu(ctx, user);
	}

	private async promptCaptcha(ctx: BotContext, userId: number): Promise<void> {
		const challenge = ctx.services.captchaService.createChallenge();
		await ctx.services.userRepository.setCaptchaChallenge(userId, challenge);
		await ctx.reply(
			[
				"👋 Welcome to Trady Giveaway!",
				"",
				"Before you can join the giveaway we just need a quick verification.",
				challenge.prompt,
			].join("\n"),
			{ reply_markup: CaptchaHandler.buildKeyboard(challenge.options) }
		);
	}

	private async showMainMenu(ctx: BotContext, _user: UserRecord): Promise<void> {
		await ctx.reply(MENU_PLACEHOLDER_TEXT, {
			reply_markup: buildMainMenuKeyboard(ctx.config, ctx.chatId),
			link_preview_options: { is_disabled: true },
		});
	}

	private extractReferralId(ctx: BotContext): number | undefined {
		const match = typeof ctx.match === "string" ? ctx.match : Array.isArray(ctx.match) ? ctx.match[0] : undefined;
		const messageText = ctx.message?.text ?? "";
		const [, payloadFromMessage] = messageText.trim().split(/\s+/, 2);
		const raw = (match ?? payloadFromMessage ?? "").trim().split(/\s+/)[0];
		if (!raw) {
			return undefined;
		}
		const candidate = Number.parseInt(raw, 10);
		return Number.isSafeInteger(candidate) && candidate > 0 ? candidate : undefined;
	}
}

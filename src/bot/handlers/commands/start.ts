import { Composer } from "grammy";

import type { BotContext } from "../../../types/context";
import { TelegramMembershipVerifier } from "../../helpers/membership";
import { buildMainMenuKeyboard } from "../../ui/replyKeyboards";
import { CaptchaHandler } from "../captcha";

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

		await repo.getOrCreate(userId, {
			username: ctx.from.username,
			firstName: ctx.from.first_name,
			lastName: ctx.from.last_name,
		});

		const user = await repo.get(userId);
		if (!user) {
			await ctx.reply("Something went wrong while loading your profile.");
			return;
		}

		if (!user.captchaPassed) {
			await this.promptCaptcha(ctx, userId);
			return;
		}
	}

	private async promptCaptcha(ctx: BotContext, userId: number): Promise<void> {
		const challenge = ctx.services.captchaService.createChallenge();
		await ctx.services.userRepository.setCaptchaChallenge(userId, challenge);
		await ctx.reply(
			[
				"👋 Welcome to Project Quest!",
				"",
				"Before you can join the giveaway we just need a quick verification.",
				challenge.prompt,
			].join("\n"),
			{ reply_markup: CaptchaHandler.buildKeyboard(challenge.options) }
		);
	}
}

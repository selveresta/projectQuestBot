import { Composer } from "grammy";

import type { BotContext } from "../../../types/context";
import { buildMainMenuKeyboard, buildMainMenuMessage } from "../../ui/replyKeyboards";
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
		const user = await ctx.services.userRepository.getOrCreate(userId, {
			username: ctx.from.username,
			firstName: ctx.from.first_name,
			lastName: ctx.from.last_name,
		});

		if (!user.captchaPassed) {
			await this.promptCaptcha(ctx, userId);
			return;
		}

		await this.showMainMenu(ctx);
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

	private async showMainMenu(ctx: BotContext): Promise<void> {
		await ctx.reply(buildMainMenuMessage(), { reply_markup: buildMainMenuKeyboard(ctx.config, ctx.chatId) });
	}
}

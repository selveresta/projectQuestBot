import { Composer, InlineKeyboard } from "grammy";

import type { BotContext } from "../../types/context";
import type { UserRecord } from "../../types/user";
import { buildMainMenuKeyboard, buildMainMenuMessage, buildReferralLink } from "../ui/replyKeyboards";

export class CaptchaHandler {
	static buildKeyboard(options: string[]): InlineKeyboard {
		const keyboard = new InlineKeyboard();
		options.forEach((emoji) => {
			keyboard.text(emoji, `captcha:${emoji}`);
		});
		return keyboard;
	}

	register(composer: Composer<BotContext>): void {
		composer.callbackQuery(/^captcha:(.+)$/, this.handleCaptchaResponse.bind(this));
	}

	private async handleCaptchaResponse(ctx: BotContext): Promise<void> {
		const selection = ctx.match?.[1];
		const userId = ctx.from?.id;
		if (!selection || !userId) {
			await ctx.answerCallbackQuery({
				text: "Something went wrong. Please try again.",
				show_alert: true,
			});
			return;
		}

                const repo = ctx.services.userRepository;
                const captcha = ctx.services.captchaService;
                const existingUser = await repo.get(userId);

                if (!existingUser || !existingUser.pendingCaptcha) {
                        await this.regenerateChallenge(ctx, userId);
                        return;
                }

                if (captcha.isExpired(existingUser.pendingCaptcha)) {
                        await ctx.answerCallbackQuery({ text: "Captcha expired. Try again." });
                        await this.regenerateChallenge(ctx, userId);
                        return;
                }

                const isCorrect = captcha.verify(existingUser.pendingCaptcha, selection);
		if (!isCorrect) {
			await this.handleIncorrectAttempt(ctx, userId);
			return;
		}

                const updatedUser = await repo.markCaptchaPassed(userId);
                await ctx.editMessageText("✅ You passed the human check!");
                await this.showMainMenu(ctx, updatedUser);
	}

	private async regenerateChallenge(ctx: BotContext, userId: number): Promise<void> {
		const captcha = ctx.services.captchaService;
		const repo = ctx.services.userRepository;
		const challenge = captcha.createChallenge();
		await repo.setCaptchaChallenge(userId, challenge);
		await ctx.editMessageText(challenge.prompt, {
			reply_markup: CaptchaHandler.buildKeyboard(challenge.options),
		});
	}

	private async handleIncorrectAttempt(ctx: BotContext, userId: number): Promise<void> {
		const repo = ctx.services.userRepository;
		const captcha = ctx.services.captchaService;
		const user = await repo.incrementCaptchaAttempts(userId);
		const attemptsLeft = ctx.config.captchaRetries - user.captchaAttempts;
		const message =
			attemptsLeft > 0
				? `Nope, that's not it. Attempts left: ${attemptsLeft}`
				: "Too many failed attempts. Generating a new captcha.";

		await ctx.answerCallbackQuery({ text: message, show_alert: true });

		if (attemptsLeft <= 0) {
			const challenge = captcha.createChallenge();
			await repo.setCaptchaChallenge(userId, challenge);
			await ctx.editMessageText(challenge.prompt, {
				reply_markup: CaptchaHandler.buildKeyboard(challenge.options),
			});
		}
	}

        private async showMainMenu(ctx: BotContext, user: UserRecord): Promise<void> {
                const referralLink = buildReferralLink(ctx.me?.username, user.userId);
                const message = buildMainMenuMessage({
                        points: user.points ?? 0,
                        referralsCount: user.creditedReferrals?.length ?? 0,
                        referralLink,
                });
                await ctx.reply(message, {
                        reply_markup: buildMainMenuKeyboard(ctx.config, ctx.chatId),
                        link_preview_options: { is_disabled: true },
                });
        }
}

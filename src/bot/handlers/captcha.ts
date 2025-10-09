import { Composer, InlineKeyboard } from "grammy";

import type { BotContext } from "../../types/context";
import { ensureTelegramMembership } from "../helpers/membership";
import { buildMainMenuKeyboard } from "../ui/replyKeyboards";

export function buildCaptchaKeyboard(options: string[]): InlineKeyboard {
	const keyboard = new InlineKeyboard();
	options.forEach((emoji) => {
		keyboard.text(emoji, `captcha:${emoji}`);
	});
	return keyboard;
}

export function registerCaptchaHandlers(composer: Composer<BotContext>): void {
	composer.callbackQuery(/^captcha:(.+)$/, async (ctx) => {
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

		const user = await repo.get(userId);
		if (!user || !user.pendingCaptcha) {
			await ctx.answerCallbackQuery({
				text: "Captcha expired. Requesting a new one...",
				show_alert: true,
			});
			const challenge = captcha.createChallenge();
			await repo.setCaptchaChallenge(userId, challenge);
			await ctx.editMessageText(challenge.prompt, {
				reply_markup: buildCaptchaKeyboard(challenge.options),
			});
			return;
		}

		if (captcha.isExpired(user.pendingCaptcha)) {
			await ctx.answerCallbackQuery({ text: "Captcha expired. Try again." });
			const challenge = captcha.createChallenge();
			await repo.setCaptchaChallenge(userId, challenge);
			await ctx.editMessageText(challenge.prompt, {
				reply_markup: buildCaptchaKeyboard(challenge.options),
			});
			return;
		}

		const isCorrect = captcha.verify(user.pendingCaptcha, selection);
		if (!isCorrect) {
			await repo.incrementCaptchaAttempts(userId);
			const attemptsLeft = ctx.config.captchaRetries - (user.captchaAttempts + 1);
			const message =
				attemptsLeft > 0
					? `Nope, that's not it. Attempts left: ${attemptsLeft}`
					: "Too many failed attempts. Generating a new captcha.";
			await ctx.answerCallbackQuery({ text: message, show_alert: true });

			if (attemptsLeft <= 0) {
				const challenge = captcha.createChallenge();
				await repo.setCaptchaChallenge(userId, challenge);
				await ctx.editMessageText(challenge.prompt, {
					reply_markup: buildCaptchaKeyboard(challenge.options),
				});
			}

			return;
		}

		await repo.markCaptchaPassed(userId);
		await ctx.answerCallbackQuery({ text: "Verified!", show_alert: true });

		await ctx.editMessageText("✅ You passed the human check! Let's complete the quests.");

		const membershipOk = await ensureTelegramMembership(ctx);
		if (!membershipOk) {
			await ctx.reply("Join the channel and run /start when you are ready to continue.");
			return;
		}

		const questStatus = await ctx.services.questService.buildQuestStatus(userId);
		const summary = questStatus
			.map((item) => {
				const status = item.completed ? "✅" : "⏳";
				return `${status} ${item.definition.title}`;
			})
			.join("\n");

			await ctx.reply(
				[
					"You're all set! Here is your current quest status:",
					summary,
					"",
					"Use the buttons below to keep track of your progress.",
				].join("\n"),
				{ reply_markup: buildMainMenuKeyboard() }
			);
		});
	}

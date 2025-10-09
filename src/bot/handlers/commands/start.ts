import { Composer } from "grammy";

import type { BotContext } from "../../../types/context";
import { ensureTelegramMembership } from "../../helpers/membership";
import { buildMainMenuKeyboard } from "../../ui/replyKeyboards";
import { buildCaptchaKeyboard } from "../captcha";

export function registerStartCommand(composer: Composer<BotContext>): void {
	composer.command("start", async (ctx) => {
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
			const challenge = ctx.services.captchaService.createChallenge();
			await repo.setCaptchaChallenge(userId, challenge);
			await ctx.reply(
				[
					"👋 Welcome to Project Quest!",
					"",
					"Before you can join the giveaway we just need a quick verification.",
					challenge.prompt,
				].join("\n"),
				{ reply_markup: buildCaptchaKeyboard(challenge.options) }
			);
			return;
		}

		const membershipOk = await ensureTelegramMembership(ctx);
		if (!membershipOk) {
			return;
		}

		const questStatus = await ctx.services.questService.buildQuestStatus(userId);
		const completedCount = questStatus.filter((item) => item.completed).length;
		const total = questStatus.length;

			await ctx.reply(
				[
					"🎉 Welcome back!",
					`You have completed ${completedCount}/${total} quests.`,
					"Use the buttons below to check status or submit remaining details.",
				].join("\n"),
				{ reply_markup: buildMainMenuKeyboard() }
			);
		});
	}

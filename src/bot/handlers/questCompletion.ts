import { Composer, InlineKeyboard } from "grammy";

import type { BotContext } from "../../types/context";
import type { QuestDefinition, QuestId } from "../../types/quest";
import {
	getExistingSocialUrl,
	getSocialInvalidMessage,
	getSocialSuccessMessage,
	identifySocialQuestFromMessage,
	isSocialQuestId,
	isValidSocialProfileInput,
	normalizeSocialProfileInput,
	promptForSocialProfile,
	saveSocialProfile,
	getSocialPlatform,
	getSocialTargetUrl,
	ensureSocialBaseline,
	getSocialBaseline,
	isBaselinePending,
	clearSocialBaseline,
	clearPendingSocialQuest,
} from "../helpers/socialQuests";
import { notifyReferralBonus } from "../helpers/referrals";
import { verifySocialFollow, DEFAULT_WAIT_MS } from "../../services/socialVerification";

export class StubQuestHandler {
	register(composer: Composer<BotContext>): void {
		composer.callbackQuery(/^quest:(.+):complete$/, this.handleStubCompletion.bind(this));
		composer.callbackQuery(/^quest:(.+):verify$/, this.handleSocialVerification.bind(this));
		composer.on("message:text", this.handleTextResponse.bind(this));
	}

	buildKeyboard(definitions: QuestDefinition[], pendingQuestIds: QuestId[]): InlineKeyboard | undefined {
		if (pendingQuestIds.length === 0) {
			return undefined;
		}

		const stubDefinitions = definitions.filter((quest) => quest.phase === "stub" && pendingQuestIds.includes(quest.id));

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

	private async handleStubCompletion(ctx: BotContext): Promise<void> {
		const questId = ctx.match?.[1] as QuestId | undefined;
		if (!questId) {
			await ctx.answerCallbackQuery({ text: "Unknown quest." });
			return;
		}

		const questService = ctx.services.questService;
		const quest = questService.getDefinition(questId);
		if (!quest || quest.phase !== "stub") {
			await ctx.answerCallbackQuery({
				text: "This quest requires automated verification (Phase 2).",
				show_alert: true,
			});
			return;
		}

		if (isSocialQuestId(questId)) {
			const userId = ctx.from?.id;
			if (!userId) {
				await ctx.answerCallbackQuery({
					text: "Could not resolve your Telegram ID.",
					show_alert: true,
				});
				return;
			}

			const user = await questService.getUser(userId);
			const existing = getExistingSocialUrl(user, questId);
			await ctx.answerCallbackQuery({
				text: existing ? "Reply with your profile link to update it." : "Reply with your profile link so we can record it.",
				show_alert: false,
			});
			await promptForSocialProfile(ctx, questId, existing);
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

		const alreadyCompleted = await questService.hasCompletedQuest(userId, questId);
		if (alreadyCompleted) {
			await ctx.answerCallbackQuery({ text: "Already marked as complete." });
			return;
		}

		const completion = await questService.completeQuest(userId, questId);
		await notifyReferralBonus(ctx, completion.referralRewardedReferrerId);
		await ctx.answerCallbackQuery({
			text: `${quest.title} marked as complete.`,
			show_alert: false,
		});

		await ctx.editMessageText("Quest recorded. Run /status to check your updated progress.");
	}

	private async handleSocialVerification(ctx: BotContext): Promise<void> {
		const questId = ctx.match?.[1] as QuestId | undefined;
		if (!questId || !isSocialQuestId(questId)) {
			await ctx.answerCallbackQuery({ text: "Unsupported quest.", show_alert: true });
			return;
		}

		const userId = ctx.from?.id;
		if (!userId) {
			await ctx.answerCallbackQuery({ text: "Could not resolve your Telegram ID.", show_alert: true });
			return;
		}

		const questService = ctx.services.questService;
		const user = await questService.getUser(userId);
		const userProfileUrl = getExistingSocialUrl(user, questId);
		if (!userProfileUrl) {
			await ctx.answerCallbackQuery({
				text: "Please submit your profile link first.",
				show_alert: true,
			});
			await promptForSocialProfile(ctx, questId);
			return;
		}

		const targetUrl = getSocialTargetUrl(ctx.config, questId);
		if (!targetUrl) {
			await ctx.answerCallbackQuery({ text: "The target profile is not configured.", show_alert: true });
			return;
		}

		const baseline = await getSocialBaseline(ctx, userId, questId);
		if (!baseline) {
			if (await isBaselinePending(ctx, userId, questId)) {
				await ctx.answerCallbackQuery({
					text: "Preparing baseline. Please wait a moment and try verify again.",
					show_alert: true,
				});
				return;
			}

			const createdBaseline = await ensureSocialBaseline(ctx, userId, questId, userProfileUrl);
			if (!createdBaseline) {
				await ctx.answerCallbackQuery({
					text: "Could not capture baseline counts. Please try again in a few moments.",
					show_alert: true,
				});
				return;
			}

			await ctx.answerCallbackQuery({
				text: "Baseline recorded. Follow the profile and tap verify again when you're ready.",
				show_alert: true,
			});
			await ctx.reply(
				[
					"📊 Baseline counts captured.",
					"Follow the target profile now, wait a few seconds, then press the verify button again.",
				].join("\n")
			);
			return;
		}

		const waitSeconds = Math.round(DEFAULT_WAIT_MS / 1000);
		await ctx.answerCallbackQuery({
			text: `Verification started. This can take about ${waitSeconds} ${waitSeconds === 1 ? "second" : "seconds"}.`,
		});
		const pendingMessage = await ctx.reply(
			`⏳ Verifying your follow for ${questId === "x_follow" ? "X" : "Instagram"}. Please wait...`
		);

		try {
			const platform = getSocialPlatform(questId);
			const result = await verifySocialFollow({
				platform,
				userUrl: userProfileUrl,
				targetUrl,
				baseline,
			});

			if (!result.success) {
				await ctx.api.editMessageText(
					pendingMessage.chat.id,
					pendingMessage.message_id,
					[
						"⚠️ Could not confirm the follow.",
						result.reason ?? "Please ensure you have followed the profile and try again.",
					].join("\n")
				);
				return;
			}

			const metadata = JSON.stringify({
				verifiedAt: new Date().toISOString(),
				platform,
				userBefore: result.userBefore,
				userAfter: result.userAfter,
				targetBefore: result.targetBefore,
				targetAfter: result.targetAfter,
			});
			const completion = await questService.completeQuest(userId, questId, metadata);
			await notifyReferralBonus(ctx, completion.referralRewardedReferrerId);
			await ctx.api.editMessageText(
				pendingMessage.chat.id,
				pendingMessage.message_id,
				"✅ Follow verified! The quest has been marked as complete."
			);
		} catch (error) {
			console.error("[socialVerification] failed", {
				userId,
				questId,
				error,
			});
			await ctx.api.editMessageText(
				pendingMessage.chat.id,
				pendingMessage.message_id,
				["❌ Verification failed due to an unexpected error.", "Please try again later."].join("\n")
			);
		} finally {
			await clearSocialBaseline(ctx, userId, questId);
		}
	}

	private async handleTextResponse(ctx: BotContext, next: () => Promise<void>): Promise<void> {
		if (!ctx.from) {
			await next();
			return;
		}

		const questId = await identifySocialQuestFromMessage(ctx);
		if (!questId) {
			await next();
			return;
		}

		const input = ctx.message?.text?.trim() ?? "";
		if (!isValidSocialProfileInput(input, questId)) {
			await ctx.reply(getSocialInvalidMessage(questId));
			await promptForSocialProfile(ctx, questId);
			return;
		}

		const userId = ctx.from.id;
		const normalized = normalizeSocialProfileInput(input, questId);
		await saveSocialProfile(ctx.services.questService, userId, questId, normalized);
		await clearSocialBaseline(ctx, userId, questId);
		await clearPendingSocialQuest(ctx);
		await ctx.reply(getSocialSuccessMessage(questId));
	}
}

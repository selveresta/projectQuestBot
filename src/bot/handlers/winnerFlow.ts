import { Composer, InlineKeyboard } from "grammy";

import type { BotContext } from "../../types/context";
import { SELECTED_WINNER_IDS } from "./commands/admin";
import { GIVEAWAY_ENDED_MESSAGE } from "./giveawayClosed";

export const WINNER_CALLBACK_PREFIX = "winner_flow:";
const CONFIRM_ACTION = `${WINNER_CALLBACK_PREFIX}confirm`;
const CHANGE_WALLET_ACTION = `${WINNER_CALLBACK_PREFIX}change`;

export const WINNER_PROMPT_MESSAGE = `
Rewards will be sent within 3 hours to everyone who has successfully confirmed their participation.

Those who haven’t confirmed yet — you have 48 hours to do so.

Regarding invite codes for Early Access:

Top 1–10 winners will receive their exclusive invite codes closer to the Early Access launch.

Stay tuned — more updates soon!`;
export const WINNER_LOCK_MESSAGE = "You have already won, wait for the award to be credited.";

export function buildWinnerPromptMessage(wallet?: string): string {
	const walletText = wallet ?? "No wallet saved yet.";
	return [WINNER_PROMPT_MESSAGE].join("\n");
}

export function createWinnerConfirmationKeyboard(): InlineKeyboard {
	return new InlineKeyboard().text("Claim Reward✅", CONFIRM_ACTION).text("Change wallet❌", CHANGE_WALLET_ACTION);
}

export class WinnerFlowHandler {
	register(composer: Composer<BotContext>): void {
		composer.callbackQuery(CONFIRM_ACTION, this.handleConfirm.bind(this));
		composer.callbackQuery(CHANGE_WALLET_ACTION, this.handleWalletChangeRequest.bind(this));
		composer.on("message:text", (ctx, next) => this.handlePotentialWalletInput(ctx, next));
	}

	private async handleWinnerPrompt(ctx: BotContext): Promise<void> {
		if (!ctx.from) {
			return;
		}

		const userId = ctx.from.id;
		const alreadyWinner = await ctx.services.winnerService.hasWinner(userId);
		// if (alreadyWinner) {
		// 	await ctx.reply(WINNER_LOCK_MESSAGE);
		// 	return;
		// }

		const wallet = await ctx.services.winnerService.resolveWalletHint(userId);
		const message = buildWinnerPromptMessage(wallet);
		await ctx.reply(message);
	}

	private async handleConfirm(ctx: BotContext): Promise<void> {
		if (!ctx.from) {
			await ctx.answerCallbackQuery();
			return;
		}

		const userId = ctx.from.id;
		const alreadyWinner = await ctx.services.winnerService.hasWinner(userId);
		if (alreadyWinner) {
			await this.sendWinnerLockedCallbackResponse(ctx);
			return;
		}

		const wallet = await ctx.services.winnerService.resolveWalletHint(userId);
		if (!wallet) {
			await ctx.answerCallbackQuery({
				text: "Please submit a wallet via “Change wallet❌” first.",
				show_alert: true,
			});
			return;
		}

		await ctx.services.winnerService.confirmWinner(userId, wallet);
		await ctx.answerCallbackQuery({ text: "Wallet confirmed!" });
		await ctx.reply(["🎉 Wallet confirmed.", `We'll use ${wallet} for your reward distribution.`, "", WINNER_LOCK_MESSAGE].join("\n"));
	}

	private async handleWalletChangeRequest(ctx: BotContext): Promise<void> {
		if (!ctx.from) {
			await ctx.answerCallbackQuery();
			return;
		}

		if (!SELECTED_WINNER_IDS.includes(ctx.from.id)) {
			if (ctx.update.callback_query) {
				try {
					await ctx.answerCallbackQuery({ text: GIVEAWAY_ENDED_MESSAGE, show_alert: true });
				} catch (error) {
					console.error("[giveawayClosed] failed to answer callback", { error });
				}
			}

			if (ctx.chat) {
				await ctx.reply(GIVEAWAY_ENDED_MESSAGE);
			}
		}

		const userId = ctx.from.id;
		const alreadyWinner = await ctx.services.winnerService.hasWinner(userId);
		if (alreadyWinner) {
			await this.sendWinnerLockedCallbackResponse(ctx);
			return;
		}

		await ctx.services.winnerService.beginWalletUpdate(userId);
		await ctx.answerCallbackQuery({ text: "Send a new wallet here." });
		await ctx.reply(
			[
				"✍️ Please send the new wallet you want to use for the reward.",
				"It can be any string — we will save it as a candidate until you confirm.",
			].join("\n")
		);
	}

	private async handlePotentialWalletInput(ctx: BotContext, next: () => Promise<void>): Promise<void> {
		if (!ctx.from) {
			await next();
			return;
		}

		const userId = ctx.from.id;
		const alreadyWinner = await ctx.services.winnerService.hasWinner(userId);
		if (alreadyWinner) {
			await ctx.reply(WINNER_LOCK_MESSAGE);
			return;
		}

		const awaitingWallet = await ctx.services.winnerService.isAwaitingWallet(userId);
		if (!awaitingWallet) {
			await next();
			return;
		}

		const text = ctx.message?.text?.trim();
		if (!text) {
			await next();
			return;
		}

		if (text.startsWith("/")) {
			await next();
			return;
		}

		await ctx.services.winnerService.saveCandidateWallet(userId, text);
		await ctx.services.winnerService.finishWalletUpdate(userId);
		await ctx.reply("✅ Wallet saved. Please confirm it using the buttons below.");
		await this.handleWinnerPrompt(ctx);
	}

	private async sendWinnerLockedCallbackResponse(ctx: BotContext): Promise<void> {
		try {
			await ctx.answerCallbackQuery({
				text: WINNER_LOCK_MESSAGE,
				show_alert: true,
			});
		} catch (error) {
			console.error("[winnerFlow] failed to answer callback for locked winner", { error });
		}

		await ctx.reply(WINNER_LOCK_MESSAGE);
	}
}

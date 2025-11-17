import { Composer } from "grammy";

import type { BotContext } from "../../types/context";
import { BUTTON_ADMIN_PANEL } from "../ui/replyKeyboards";
import { WINNER_CALLBACK_PREFIX } from "./winnerFlow";

export const GIVEAWAY_ENDED_MESSAGE = "Hello! The giveaway has ended. Thanks for participating.";

export class GiveawayClosedHandler {
	register(composer: Composer<BotContext>): void {
		composer.use(async (ctx, next) => {
			if (await this.shouldBypass(ctx)) {
				await next();
				return;
			}

			await this.sendGiveawayNotice(ctx);
		});
	}

	private async shouldBypass(ctx: BotContext): Promise<boolean> {
		const userId = ctx.from?.id;
		if (!userId) {
			return false;
		}

		if (ctx.config.adminIds.includes(userId)) {
			return true;
		}

		const text = ctx.message?.text?.trim();
		if (text === BUTTON_ADMIN_PANEL || text?.startsWith("/admin")) {
			return true;
		}

		const callbackData = ctx.update.callback_query?.data;
		if (typeof callbackData === "string" && callbackData.startsWith(WINNER_CALLBACK_PREFIX)) {
			return true;
		}

		if (text) {
			const awaitingWinnerWallet = await ctx.services.winnerService.isAwaitingWallet(userId);
			if (awaitingWinnerWallet) {
				return true;
			}
		}

		return false;
	}

	private async sendGiveawayNotice(ctx: BotContext): Promise<void> {
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
}

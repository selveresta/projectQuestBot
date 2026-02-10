import { Composer } from "grammy";

import type { BotContext } from "../../types/context";
import {
	BUTTON_ABOUT,
	BUTTON_ADMIN_PANEL,
	BUTTON_CHECK_STATUS,
	BUTTON_INVITE_FRIENDS,
	BUTTON_LEADERBOARD,
	BUTTON_QUEST_LIST,
	BUTTON_SET_INSTAGRAM,
	BUTTON_SET_X,
	MENU_PLACEHOLDER_TEXT,
	buildMainMenuKeyboard,
} from "../ui/replyKeyboards";
import { WINNER_CALLBACK_PREFIX } from "./winnerFlow";
import { isAwaitingWhitelistEmail, WHITELIST_JOIN_CALLBACK } from "./whitelistFlow";

export const GIVEAWAY_ENDED_MESSAGE = "Hello! The giveaway has ended. Thanks for participating.";
const LEGACY_USER_MENU_BUTTONS = new Set<string>([
	BUTTON_QUEST_LIST,
	BUTTON_SET_INSTAGRAM,
	BUTTON_SET_X,
	BUTTON_CHECK_STATUS,
	BUTTON_INVITE_FRIENDS,
	BUTTON_LEADERBOARD,
	BUTTON_ABOUT,
]);

export class GiveawayClosedHandler {
	register(composer: Composer<BotContext>): void {
		composer.use(async (ctx, next) => {
			if (this.isLegacyUserMenuTap(ctx)) {
				await this.refreshMainMenu(ctx);
				return;
			}

			if (await this.shouldBypass(ctx)) {
				await next();
				return;
			}

			await this.sendGiveawayNotice(ctx);
		});
	}

	private isLegacyUserMenuTap(ctx: BotContext): boolean {
		const text = ctx.message?.text?.trim();
		return Boolean(text && LEGACY_USER_MENU_BUTTONS.has(text));
	}

	private async refreshMainMenu(ctx: BotContext): Promise<void> {
		const userId = ctx.from?.id ?? ctx.chat?.id;
		await ctx.reply(MENU_PLACEHOLDER_TEXT, {
			reply_markup: buildMainMenuKeyboard(ctx.config, userId),
			link_preview_options: { is_disabled: true },
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
		if (
			typeof callbackData === "string" &&
			(callbackData.startsWith(WINNER_CALLBACK_PREFIX) || callbackData === WHITELIST_JOIN_CALLBACK)
		) {
			return true;
		}

		if (text) {
			const awaitingWinnerWallet = await ctx.services.winnerService.isAwaitingWallet(userId);
			if (awaitingWinnerWallet) {
				return true;
			}
			const awaitingWhitelistEmail = await isAwaitingWhitelistEmail(ctx, userId);
			if (awaitingWhitelistEmail) {
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

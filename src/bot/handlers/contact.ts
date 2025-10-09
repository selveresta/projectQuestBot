import { Composer } from "grammy";

import type { BotContext } from "../../types/context";
import {
	buildMainMenuKeyboard,
	BUTTON_SUBMIT_EMAIL,
	BUTTON_SUBMIT_WALLET,
} from "../ui/replyKeyboards";

const EMAIL_PROMPT =
	"✉️ Please reply to this message with the email you want to use for the giveaway.";
const WALLET_PROMPT =
	"💼 Please reply to this message with your EVM wallet address (0x…).";

function isReplyToPrompt(ctx: BotContext, prompt: string): boolean {
	const reply = ctx.message?.reply_to_message;
	if (!reply?.text) {
		return false;
	}
	if (reply.from?.id !== ctx.me?.id) {
		return false;
	}
	return reply.text.startsWith(prompt);
}

function isValidEmail(input: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
}

function isValidWallet(input: string): boolean {
	return /^0x[a-fA-F0-9]{40}$/.test(input);
}

async function promptForEmail(ctx: BotContext): Promise<void> {
	if (!ctx.from) {
		return;
	}

	await ctx.reply(EMAIL_PROMPT, {
		reply_markup: { force_reply: true, selective: true },
	});
}

async function promptForWallet(ctx: BotContext): Promise<void> {
	if (!ctx.from) {
		return;
	}

	await ctx.reply(WALLET_PROMPT, {
		reply_markup: { force_reply: true, selective: true },
	});
}

export function registerContactHandlers(composer: Composer<BotContext>): void {
	composer.command("email", promptForEmail);
	composer.hears(BUTTON_SUBMIT_EMAIL, promptForEmail);

	composer.command("wallet", promptForWallet);
	composer.hears(BUTTON_SUBMIT_WALLET, promptForWallet);

	composer.on("message:text", async (ctx, next) => {
		if (!ctx.from) {
			return;
		}
		const userId = ctx.from.id;
		const text = ctx.message?.text?.trim() ?? "";

		if (isReplyToPrompt(ctx, EMAIL_PROMPT)) {
			if (!isValidEmail(text)) {
				await ctx.reply("That does not look like a valid email. Try again?");
				return;
			}

			await ctx.services.questService.updateContact(userId, { email: text });
			await ctx.services.questService.completeQuest(userId, "email_submit", text);
			await ctx.reply("✅ Email saved. You can update it at any time via the menu.", {
				reply_markup: buildMainMenuKeyboard(),
			});
			return;
		}

		if (isReplyToPrompt(ctx, WALLET_PROMPT)) {
			if (!isValidWallet(text)) {
				await ctx.reply(
					"The wallet should be a 0x… hexadecimal address. Please double-check and resend.",
				);
				return;
			}

			await ctx.services.questService.updateContact(userId, { wallet: text });
			await ctx.services.questService.completeQuest(userId, "wallet_submit", text);
			await ctx.reply("✅ Wallet saved. Run /status to make sure everything looks good.", {
				reply_markup: buildMainMenuKeyboard(),
			});
			return;
		}

		await next();
	});
}

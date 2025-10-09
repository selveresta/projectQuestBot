import { Composer } from "grammy";

import type { BotContext } from "../../types/context";

const EMAIL_PROMPT = "✉️ Please reply to this message with the email you want to use for the giveaway.";
const WALLET_PROMPT = "💼 Please reply to this message with your EVM wallet address (0x…).";

function isReplyToPrompt(ctx: BotContext, prompt: string): boolean {
	const reply = ctx.message?.reply_to_message;
	if (!reply) {
		return false;
	}
	if (!reply.text) {
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

export function registerContactHandlers(composer: Composer<BotContext>): void {
	composer.command("email", async (ctx) => {
		if (!ctx.from) {
			return;
		}

		await ctx.reply(EMAIL_PROMPT, {
			reply_markup: { force_reply: true, selective: true },
		});
	});

	composer.command("wallet", async (ctx) => {
		if (!ctx.from) {
			return;
		}

		await ctx.reply(WALLET_PROMPT, {
			reply_markup: { force_reply: true, selective: true },
		});
	});

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
			await ctx.reply("✅ Email saved. You can update it at any time by sending /email again.");
			return;
		}

		if (isReplyToPrompt(ctx, WALLET_PROMPT)) {
			if (!isValidWallet(text)) {
				await ctx.reply("The wallet should be a 0x… hexadecimal address. Please double-check and resend.");
				return;
			}

			await ctx.services.questService.updateContact(userId, { wallet: text });
			await ctx.services.questService.completeQuest(userId, "wallet_submit", text);
			await ctx.reply("✅ Wallet saved. Run /status to make sure everything looks good.");
			return;
		}

		await next();
	});
}

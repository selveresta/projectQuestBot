import { Composer } from "grammy";

import type { BotContext } from "../../types/context";
import { buildMainMenuKeyboard } from "../ui/replyKeyboards";

const EMAIL_PROMPT =
	"✉️ Please reply to this message with the email you want to use for the giveaway.";
const WALLET_PROMPT =
	"💼 Please reply to this message with your EVM wallet address (0x…).";

export class ContactHandler {
	register(composer: Composer<BotContext>): void {
		composer.command("email", this.promptForEmail.bind(this));

		composer.command("wallet", this.promptForWallet.bind(this));

		composer.on("message:text", this.handleTextMessage.bind(this));
	}

	private async promptForEmail(ctx: BotContext): Promise<void> {
		if (!ctx.from) {
			return;
		}

		await ctx.reply(EMAIL_PROMPT, {
			reply_markup: { force_reply: true, selective: true },
		});
	}

	private async promptForWallet(ctx: BotContext): Promise<void> {
		if (!ctx.from) {
			return;
		}

		await ctx.reply(WALLET_PROMPT, {
			reply_markup: { force_reply: true, selective: true },
		});
	}

	private async handleTextMessage(ctx: BotContext, next: () => Promise<void>): Promise<void> {
		if (!ctx.from) {
			return;
		}
		const userId = ctx.from.id;
		const text = ctx.message?.text?.trim() ?? "";

		if (this.isReplyToPrompt(ctx, EMAIL_PROMPT)) {
			await this.processEmail(ctx, userId, text);
			return;
		}

		if (this.isReplyToPrompt(ctx, WALLET_PROMPT)) {
			await this.processWallet(ctx, userId, text);
			return;
		}

		await next();
	}

	private async processEmail(ctx: BotContext, userId: number, email: string): Promise<void> {
		if (!this.isValidEmail(email)) {
			await ctx.reply("That does not look like a valid email. Try again?");
			return;
		}

		await ctx.services.questService.updateContact(userId, { email });
		await ctx.services.questService.completeQuest(userId, "email_submit", email);
		await ctx.reply("✅ Email saved. You can update it at any time via the menu.", {
			reply_markup: buildMainMenuKeyboard(ctx.config),
		});
	}

	private async processWallet(ctx: BotContext, userId: number, wallet: string): Promise<void> {
		if (!this.isValidWallet(wallet)) {
			await ctx.reply(
				"The wallet should be a 0x… hexadecimal address. Please double-check and resend."
			);
			return;
		}

		await ctx.services.questService.updateContact(userId, { wallet });
		await ctx.services.questService.completeQuest(userId, "wallet_submit", wallet);
		await ctx.reply("✅ Wallet saved. Run /status to make sure everything looks good.", {
			reply_markup: buildMainMenuKeyboard(ctx.config),
		});
	}

	private isReplyToPrompt(ctx: BotContext, prompt: string): boolean {
		const reply = ctx.message?.reply_to_message;
		if (!reply?.text) {
			return false;
		}
		if (reply.from?.id !== ctx.me?.id) {
			return false;
		}
		return reply.text.startsWith(prompt);
	}

	private isValidEmail(input: string): boolean {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
	}

	private isValidWallet(input: string): boolean {
		return /^0x[a-fA-F0-9]{40}$/.test(input);
	}
}

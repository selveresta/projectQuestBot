import { Composer } from "grammy";

import type { BotContext } from "../../types/context";
import { DuplicateContactError } from "../../services/errors";
import { notifyReferralBonus } from "../helpers/referrals";
import { buildMainMenuKeyboard } from "../ui/replyKeyboards";

export const EMAIL_PROMPT = "✉️ Please reply to this message with the email you want to use for the giveaway.";
const EVM_WALLET_PROMPT = "💼 Please reply to this message with your EVM wallet address (0x…).";
const SOL_WALLET_PROMPT = "🔑 Please reply to this message with your SOL wallet address.";
type PendingContactType = "email" | "wallet" | "sol_wallet";
const CONTACT_PENDING_TTL_SECONDS = 600;

const CONTACT_PROMPTS: Record<PendingContactType, { prompt: string; label: string }> = {
	email: { prompt: EMAIL_PROMPT, label: "email" },
	wallet: { prompt: EVM_WALLET_PROMPT, label: "EVM wallet" },
	sol_wallet: { prompt: SOL_WALLET_PROMPT, label: "SOL wallet" },
};

function pendingContactKey(userId: number): string {
	return `pending_contact:${userId}`;
}

async function setPendingContact(ctx: BotContext, type: PendingContactType): Promise<void> {
	const userId = ctx.from?.id;
	if (!userId) {
		return;
	}
	await ctx.services.redis.set(pendingContactKey(userId), type, { EX: CONTACT_PENDING_TTL_SECONDS });
}

async function getPendingContact(ctx: BotContext): Promise<PendingContactType | undefined> {
	const userId = ctx.from?.id;
	if (!userId) {
		return undefined;
	}
	const raw = await ctx.services.redis.get(pendingContactKey(userId));
	if (raw === "email" || raw === "wallet" || raw === "sol_wallet") {
		return raw;
	}
	return undefined;
}

async function clearPendingContact(ctx: BotContext, type?: PendingContactType): Promise<void> {
	const userId = ctx.from?.id;
	if (!userId) {
		return;
	}
	const key = pendingContactKey(userId);
	if (type) {
		const current = await ctx.services.redis.get(key);
		if (current !== type) {
			return;
		}
	}
	await ctx.services.redis.del(key);
}

function buildPromptText(type: PendingContactType, existing?: string): string {
	const config = CONTACT_PROMPTS[type];
	const suffix = existing && existing.trim().length > 0 ? `Current ${config.label}: ${existing}` : undefined;
	return [config.prompt, suffix].filter(Boolean).join("\n\n");
}

export async function promptForContact(ctx: BotContext, type: PendingContactType, existing?: string): Promise<void> {
	if (!ctx.from) {
		return;
	}

	// const prompt = buildPromptText(type, existing);
	// await ctx.reply(prompt, {
	// 	reply_markup: { force_reply: true, selective: true },
	// });
	await setPendingContact(ctx, type);
}

export class ContactHandler {
	register(composer: Composer<BotContext>): void {
		composer.on("message:text", this.handleTextMessage.bind(this));
	}

	private async handleTextMessage(ctx: BotContext, next: () => Promise<void>): Promise<void> {
		if (!ctx.from) {
			await next();
			return;
		}

		const userId = ctx.from.id;
		const text = ctx.message?.text?.trim() ?? "";
		const pending = await getPendingContact(ctx);

		const isEmailContext = this.isReplyToPrompt(ctx, EMAIL_PROMPT) || pending === "email";
		if (isEmailContext) {
			if (pending === "email" && text.startsWith("/")) {
				await next();
				return;
			}
			await this.processEmail(ctx, userId, text);
			return;
		}

		const isWalletContext = this.isReplyToPrompt(ctx, EVM_WALLET_PROMPT) || pending === "wallet";
		if (isWalletContext) {
			if (pending === "wallet" && text.startsWith("/")) {
				await next();
				return;
			}
			await this.processEvmWallet(ctx, userId, text);
			return;
		}

		const isSolWalletContext = this.isReplyToPrompt(ctx, SOL_WALLET_PROMPT) || pending === "sol_wallet";
		if (isSolWalletContext) {
			if (pending === "sol_wallet" && text.startsWith("/")) {
				await next();
				return;
			}
			await this.processSolWallet(ctx, userId, text);
			return;
		}

		await next();
	}

	private async processEmail(ctx: BotContext, userId: number, email: string): Promise<void> {
		if (!this.isValidEmail(email)) {
			await ctx.reply("That does not look like a valid email. Try again?");
			return;
		}

		try {
			await ctx.services.questService.updateContact(userId, { email });
			const completion = await ctx.services.questService.completeQuest(userId, "email_submit", email);
			await notifyReferralBonus(ctx, completion.referralRewardedReferrerId);
			await clearPendingContact(ctx, "email");
			await ctx.reply("✅ Email saved. You can update it at any time via the menu.", {
				reply_markup: buildMainMenuKeyboard(ctx.config, ctx.chatId),
			});
		} catch (error) {
			if (error instanceof DuplicateContactError) {
				await clearPendingContact(ctx, "email");
				await ctx.reply("This email is already linked to another participant. Please submit a different address.");
				return;
			}
			console.error("[contact] Failed to save email", { userId, error });
			await ctx.reply("Something went wrong while saving your email. Please try again later.");
		}
	}

	private async processEvmWallet(ctx: BotContext, userId: number, wallet: string): Promise<void> {
		if (!this.isValidEvmWallet(wallet)) {
			await clearPendingContact(ctx, "wallet");
			await ctx.reply("The wallet should be a 0x… hexadecimal address. Please double-check and resend.");
			return;
		}

		try {
			await ctx.services.questService.updateContact(userId, { wallet });
			const completion = await ctx.services.questService.completeQuest(userId, "wallet_submit", wallet);
			await notifyReferralBonus(ctx, completion.referralRewardedReferrerId);
			await clearPendingContact(ctx, "wallet");
			await ctx.reply("✅ Wallet saved.", {
				reply_markup: buildMainMenuKeyboard(ctx.config, ctx.chatId),
			});
		} catch (error) {
			if (error instanceof DuplicateContactError) {
				await clearPendingContact(ctx, "wallet");
				await ctx.reply("This wallet address is already linked to another participant. Please use a different wallet.");
				return;
			}
			console.error("[contact] Failed to save wallet", { userId, error });
			await ctx.reply("Something went wrong while saving your wallet. Please try again later.");
		}
	}

	private async processSolWallet(ctx: BotContext, userId: number, wallet: string): Promise<void> {
		if (!this.isValidSolWallet(wallet)) {
			await clearPendingContact(ctx, "sol_wallet");
			await ctx.reply("The SOL wallet should be a valid Solana address (base58, 32-44 characters). Please double-check and resend.");
			return;
		}

		try {
			await ctx.services.questService.updateContact(userId, { solanaWallet: wallet });
			const completion = await ctx.services.questService.completeQuest(userId, "sol_wallet_submit", wallet);
			await notifyReferralBonus(ctx, completion.referralRewardedReferrerId);
			await clearPendingContact(ctx, "sol_wallet");
			await ctx.reply("✅ SOL wallet saved.", {
				reply_markup: buildMainMenuKeyboard(ctx.config, ctx.chatId),
			});
		} catch (error) {
			if (error instanceof DuplicateContactError) {
				await clearPendingContact(ctx, "sol_wallet");
				await ctx.reply("This SOL wallet is already linked to another participant. Please use a different address.");
				return;
			}
			console.error("[contact] Failed to save SOL wallet", { userId, error });
			await ctx.reply("Something went wrong while saving your SOL wallet. Please try again later.");
		}
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

	private isValidEvmWallet(input: string): boolean {
		return /^0x[a-fA-F0-9]{40}$/.test(input);
	}

	private isValidSolWallet(input: string): boolean {
		return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(input);
	}
}

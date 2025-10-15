import { Composer } from "grammy";

import type { BotContext } from "../../types/context";
import { buildMainMenuKeyboard } from "../ui/replyKeyboards";

export const EMAIL_PROMPT =
        "✉️ Please reply to this message with the email you want to use for the giveaway.";
const WALLET_PROMPT =
        "💼 Please reply to this message with your EVM wallet address (0x…).";
const SOL_WALLET_PROMPT =
        "🪙 Please reply to this message with your Solana wallet address.";

type PendingContactType = "email" | "wallet" | "solana_wallet";
const CONTACT_PENDING_TTL_SECONDS = 600;

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
        if (raw === "email" || raw === "wallet" || raw === "solana_wallet") {
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
        const base =
                type === "email"
                        ? EMAIL_PROMPT
                        : type === "wallet"
                        ? WALLET_PROMPT
                        : SOL_WALLET_PROMPT;
        const label =
                type === "email"
                        ? "email"
                        : type === "wallet"
                        ? "wallet"
                        : "SOL wallet";
        const suffix = existing && existing.trim().length > 0 ? `Current ${label}: ${existing}` : undefined;
        return [base, suffix].filter(Boolean).join("\n\n");
}

export async function promptForContact(
	ctx: BotContext,
	type: PendingContactType,
	existing?: string
): Promise<void> {
	if (!ctx.from) {
		return;
	}

	const prompt = buildPromptText(type, existing);
	await ctx.reply(prompt, {
		reply_markup: { force_reply: true, selective: true },
	});
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

                const isWalletContext = this.isReplyToPrompt(ctx, WALLET_PROMPT) || pending === "wallet";
                if (isWalletContext) {
                        if (pending === "wallet" && text.startsWith("/")) {
                                await next();
                                return;
                        }
                        await this.processWallet(ctx, userId, text);
                        return;
                }

                const isSolanaWalletContext =
                        this.isReplyToPrompt(ctx, SOL_WALLET_PROMPT) || pending === "solana_wallet";
                if (isSolanaWalletContext) {
                        if (pending === "solana_wallet" && text.startsWith("/")) {
                                await next();
                                return;
                        }
                        await this.processSolanaWallet(ctx, userId, text);
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
		await clearPendingContact(ctx, "email");
		await ctx.reply("✅ Email saved. You can update it at any time via the menu.", {
			reply_markup: buildMainMenuKeyboard(ctx.config, ctx.chatId),
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
                await clearPendingContact(ctx, "wallet");
                await ctx.reply("✅ Wallet saved. Run /status to make sure everything looks good.", {
                        reply_markup: buildMainMenuKeyboard(ctx.config, ctx.chatId),
                });
        }

        private async processSolanaWallet(ctx: BotContext, userId: number, wallet: string): Promise<void> {
                if (!this.isValidSolanaWallet(wallet)) {
                        await ctx.reply(
                                "That does not look like a valid Solana wallet. Solana addresses are base58 strings between 32 and 44 characters."
                        );
                        return;
                }

                await ctx.services.questService.updateContact(userId, { solanaWallet: wallet });
                await ctx.services.questService.completeQuest(userId, "sol_wallet_submit", wallet);
                await clearPendingContact(ctx, "solana_wallet");
                await ctx.reply("✅ Solana wallet saved. Keep going to climb the leaderboard!", {
                        reply_markup: buildMainMenuKeyboard(ctx.config, ctx.chatId),
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

        private isValidSolanaWallet(input: string): boolean {
                return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(input);
        }
}

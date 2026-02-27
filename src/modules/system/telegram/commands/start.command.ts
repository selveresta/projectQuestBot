import { Injectable } from "@nestjs/common";
import { z } from "zod";

import {
	RegisterTelegramUserCommand,
	RegisterTelegramUserCommandHandler,
} from "../../identity/application/commands/register-telegram-user.command";
import type { TelegramBotContext, TelegramCommandHandler } from "../telegram.types";

const StartPayloadSchema = z
	.string()
	.regex(/^\d+$/)
	.transform((value) => Number.parseInt(value, 10))
	.refine((value) => Number.isSafeInteger(value) && value > 0);

@Injectable()
export class StartCommandHandler implements TelegramCommandHandler {
	readonly command = "start";

	constructor(private readonly registerTelegramUserCommandHandler: RegisterTelegramUserCommandHandler) {}

	async execute(ctx: TelegramBotContext): Promise<void> {
		if (!ctx.from) {
			await ctx.reply("I can only process this command for Telegram users.");
			return;
		}

		const input = this.parseReferralPayload(ctx.message?.text);
		const result = await this.registerTelegramUserCommandHandler.execute(
			new RegisterTelegramUserCommand(
				ctx.from.id,
				ctx.from.username,
				ctx.from.first_name,
				ctx.from.last_name,
				input,
			),
		);

		const lines = [
			"Welcome!",
			result.referralRejectedReason === "self_referral" ? "You cannot use your own referral link." : "",
			result.referralRejectedReason === "referrer_not_found" ? "Referrer was not found." : "",
			`User ID: ${result.user.id}`,
			`Points: ${result.user.points}`,
		];
		await ctx.reply(lines.filter(Boolean).join("\n"));
	}

	private parseReferralPayload(text: string | undefined): number | undefined {
		const normalized = (text ?? "").trim();
		if (!normalized) {
			return undefined;
		}

		const parts = normalized.split(/\s+/);
		if (parts.length < 2) {
			return undefined;
		}

		const candidate = StartPayloadSchema.safeParse(parts[1]);
		if (!candidate.success) {
			return undefined;
		}
		return candidate.data;
	}
}

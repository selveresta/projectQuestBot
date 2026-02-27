import { Injectable } from "@nestjs/common";

import {
	GetIdentityProfileQuery,
	GetIdentityProfileQueryHandler,
} from "../../identity/application/queries/get-identity-profile.query";
import type { TelegramBotContext, TelegramCommandHandler } from "../telegram.types";

@Injectable()
export class StatusCommandHandler implements TelegramCommandHandler {
	readonly command = "status";

	constructor(private readonly getIdentityProfileQueryHandler: GetIdentityProfileQueryHandler) {}

	async execute(ctx: TelegramBotContext): Promise<void> {
		if (!ctx.from) {
			await ctx.reply("I can only process this command for Telegram identities.");
			return;
		}

		try {
			const profile = await this.getIdentityProfileQueryHandler.execute(new GetIdentityProfileQuery(ctx.from.id));
			if (!profile) {
				await ctx.reply("Profile not found. Use /start first.");
				return;
			}

			await ctx.reply(
				[
					`Identity: ${profile.identityId}`,
					`Telegram ID: ${profile.telegramIdentityId}`,
					`Points: ${profile.points}`,
					`Referred by: ${profile.referredBy ?? "none"}`,
				].join("\n"),
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			if (message.toLowerCase().includes("rate limit")) {
				await ctx.reply("Too many status requests. Please retry shortly.");
				return;
			}
			throw error;
		}
	}
}

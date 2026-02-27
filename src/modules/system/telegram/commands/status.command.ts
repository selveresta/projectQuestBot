import { Injectable } from "@nestjs/common";

import {
	GetUserProfileQuery,
	GetUserProfileQueryHandler,
} from "../../identity/application/queries/get-user-profile.query";
import type { TelegramBotContext, TelegramCommandHandler } from "../telegram.types";

@Injectable()
export class StatusCommandHandler implements TelegramCommandHandler {
	readonly command = "status";

	constructor(private readonly getUserProfileQueryHandler: GetUserProfileQueryHandler) {}

	async execute(ctx: TelegramBotContext): Promise<void> {
		if (!ctx.from) {
			await ctx.reply("I can only process this command for Telegram users.");
			return;
		}

		try {
			const profile = await this.getUserProfileQueryHandler.execute(new GetUserProfileQuery(ctx.from.id));
			if (!profile) {
				await ctx.reply("Profile not found. Use /start first.");
				return;
			}

			await ctx.reply(
				[
					`User: ${profile.userId}`,
					`Telegram ID: ${profile.telegramUserId}`,
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

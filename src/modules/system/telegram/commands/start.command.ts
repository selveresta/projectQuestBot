import { Injectable } from "@nestjs/common";

import {
	RegisterTelegramIdentityCommand,
	RegisterTelegramIdentityCommandHandler,
} from "../../identity/application/commands/register-telegram-identity.command";
import type { TelegramBotContext, TelegramCommandHandler } from "../telegram.types";

@Injectable()
export class StartCommandHandler implements TelegramCommandHandler {
	readonly command = "start";

	constructor(private readonly registerTelegramIdentityCommandHandler: RegisterTelegramIdentityCommandHandler) {}

	async execute(ctx: TelegramBotContext): Promise<void> {
		if (!ctx.from) {
			await ctx.reply("I can only process this command for Telegram identities.");
			return;
		}

		const result = await this.registerTelegramIdentityCommandHandler.execute(
			new RegisterTelegramIdentityCommand(ctx.from.id, ctx.from.username, ctx.from.first_name, ctx.from.last_name),
		);

		const lines = ["Welcome!", `Identity ID: ${result.identity.id}`];
		await ctx.reply(lines.filter(Boolean).join("\n"));
	}
}

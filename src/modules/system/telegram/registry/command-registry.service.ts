import { Inject, Injectable } from "@nestjs/common";
import { Bot } from "grammy";

import { LOGGER_PORT, type LoggerPort } from "../../../../shared/application/ports/logger.port";
import { TELEGRAM_COMMAND_HANDLERS } from "../telegram.constants";
import type { TelegramBotContext, TelegramCommandHandler } from "../telegram.types";

@Injectable()
export class TelegramCommandRegistryService {
	constructor(
		@Inject(TELEGRAM_COMMAND_HANDLERS)
		private readonly handlers: readonly TelegramCommandHandler[],
		@Inject(LOGGER_PORT) private readonly logger: LoggerPort,
	) {}

	register(bot: Bot<TelegramBotContext>): void {
		for (const handler of this.handlers) {
			bot.command(handler.command, async (ctx) => {
				await handler.execute(ctx);
			});
			this.logger.info("telegram_command_registered", { command: handler.command });
		}

		bot.command("help", async (ctx) => {
			const available = this.handlers.map((handler) => `/${handler.command}`).join(", ");
			await ctx.reply(`Available commands: ${available}`);
		});
	}
}

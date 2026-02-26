import { Inject, Injectable } from "@nestjs/common";
import { Bot } from "grammy";

import { PinoLoggerService } from "../../../common/logger/pino-logger.service";
import { TELEGRAM_COMMAND_HANDLERS } from "../telegram.constants";
import type { BotContext, TelegramCommandHandler } from "../telegram.types";

@Injectable()
export class CommandRegistryService {
	constructor(
		@Inject(TELEGRAM_COMMAND_HANDLERS)
		private readonly commandHandlers: readonly TelegramCommandHandler[],
		private readonly logger: PinoLoggerService
	) {}

	register(bot: Bot<BotContext>): void {
		for (const handler of this.commandHandlers) {
			bot.command(handler.command, async (ctx) => {
				await handler.execute(ctx);
			});
			this.logger.log(`Registered Telegram command /${handler.command}`);
		}

		bot.command("help", async (ctx) => {
			const commands = this.commandHandlers.map((item) => `/${item.command}`).join(", ");
			await ctx.reply(`Available commands: ${commands}`);
		});
	}
}

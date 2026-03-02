import { Inject, Injectable } from "@nestjs/common";

import { ApplicationError } from "../../../shared/application/errors/application.error";
import { LOGGER_PORT, type LoggerPort } from "../../../shared/application/ports/logger.port";
import type { TelegramBotContext } from "./telegram.types";

@Injectable()
export class TelegramErrorResponderService {
	constructor(@Inject(LOGGER_PORT) private readonly logger: LoggerPort) {}

	async handle(ctx: TelegramBotContext, command: string, error: unknown): Promise<void> {
		if (error instanceof ApplicationError) {
			await ctx.reply(error.userMessage);
			this.logger.warn("telegram_command_application_error", {
				command,
				code: error.code,
				message: error.message,
				updateId: ctx.update.update_id,
			});
			return;
		}

		const normalized = error instanceof Error ? error : new Error(String(error));
		await ctx.reply("Unexpected error occurred. Please retry later.");
		this.logger.error("telegram_command_unhandled_error", {
			command,
			message: normalized.message,
			updateId: ctx.update.update_id,
		});
	}
}

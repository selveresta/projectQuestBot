import { Inject, Injectable } from "@nestjs/common";

import { LOGGER_PORT, type LoggerPort } from "../../../../shared/application/ports/logger.port";
import type { TelegramCommandLifecycleEvent, TelegramEventHook } from "../telegram.types";

@Injectable()
export class LoggingTelegramEventHook implements TelegramEventHook {
	constructor(@Inject(LOGGER_PORT) private readonly logger: LoggerPort) {}

	async onCommandReceived(event: TelegramCommandLifecycleEvent): Promise<void> {
		this.logger.info("telegram_command_received", { ...event });
	}

	async onCommandSucceeded(event: TelegramCommandLifecycleEvent): Promise<void> {
		this.logger.info("telegram_command_succeeded", { ...event });
	}

	async onCommandFailed(event: TelegramCommandLifecycleEvent & { error: Error }): Promise<void> {
		this.logger.error("telegram_command_failed", {
			...event,
			error: event.error.message,
		});
	}
}

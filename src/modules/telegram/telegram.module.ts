import { Module } from "@nestjs/common";

import { StatusCommandHandler } from "./commands/status/status.command-handler";
import { StatusCommandModule } from "./commands/status/status.command.module";
import { StartCommandHandler } from "./commands/start/start.command-handler";
import { StartCommandModule } from "./commands/start/start.command.module";
import { TelegramInfrastructureModule } from "./infrastructure/telegram-infrastructure.module";
import { CommandRegistryService } from "./registry/command-registry.service";
import { TELEGRAM_COMMAND_HANDLERS } from "./telegram.constants";
import type { TelegramCommandHandler } from "./telegram.types";
import { TelegramService } from "./telegram.service";
import { WebhookController } from "./webhook.controller";

@Module({
	imports: [TelegramInfrastructureModule, StartCommandModule, StatusCommandModule],
	controllers: [WebhookController],
	providers: [
		CommandRegistryService,
		TelegramService,
		{
			provide: TELEGRAM_COMMAND_HANDLERS,
			inject: [StartCommandHandler, StatusCommandHandler],
			useFactory: (
				startCommandHandler: StartCommandHandler,
				statusCommandHandler: StatusCommandHandler
			): TelegramCommandHandler[] => [startCommandHandler, statusCommandHandler],
		},
	],
})
export class TelegramModule {}

import { Module } from "@nestjs/common";

import { IdentityModule } from "../identity/identity.module";
import { StartCommandHandler } from "./commands/start.command";
import { StatusCommandHandler } from "./commands/status.command";
import { TELEGRAM_COMMAND_HANDLERS } from "./telegram.constants";
import type { TelegramCommandHandler } from "./telegram.types";
import { TelegramService } from "./telegram.service";
import { TelegramWebhookController } from "./webhook.controller";
import { TelegramCommandRegistryService } from "./registry/command-registry.service";

@Module({
	imports: [IdentityModule,],
	controllers: [TelegramWebhookController],
	providers: [
		StartCommandHandler,
		StatusCommandHandler,
		TelegramCommandRegistryService,
		TelegramService,
		{
			provide: TELEGRAM_COMMAND_HANDLERS,
			inject: [StartCommandHandler, StatusCommandHandler],
			useFactory: (
				start: StartCommandHandler,
				status: StatusCommandHandler,
			): TelegramCommandHandler[] => [start, status],
		},
	],
})
export class TelegramModule {}

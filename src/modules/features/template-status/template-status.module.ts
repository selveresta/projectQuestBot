import { Module } from "@nestjs/common";

import { GetAdminDiagnosticsQueryHandler } from "./application/queries/get-admin-diagnostics.query";
import { GetTemplateStatusQueryHandler } from "./application/queries/get-template-status.query";
import { TEMPLATE_STATUS_TELEGRAM_COMMAND_HANDLERS } from "./template-status.constants";
import { TemplateAdminStatusCommandHandler } from "./telegram/commands/admin-status.command";
import { TemplatePingCommandHandler } from "./telegram/commands/ping.command";
import type { TelegramCommandHandler } from "../../system/telegram/telegram.types";

@Module({
	providers: [
		GetTemplateStatusQueryHandler,
		GetAdminDiagnosticsQueryHandler,
		TemplatePingCommandHandler,
		TemplateAdminStatusCommandHandler,
		{
			provide: TEMPLATE_STATUS_TELEGRAM_COMMAND_HANDLERS,
			inject: [TemplatePingCommandHandler, TemplateAdminStatusCommandHandler],
			useFactory: (
				pingHandler: TemplatePingCommandHandler,
				adminStatusHandler: TemplateAdminStatusCommandHandler,
			): TelegramCommandHandler[] => [pingHandler, adminStatusHandler],
		},
	],
	exports: [TEMPLATE_STATUS_TELEGRAM_COMMAND_HANDLERS],
})
export class TemplateStatusFeatureModule {}

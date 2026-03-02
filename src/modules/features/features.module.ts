import { Global, Module } from "@nestjs/common";

import {
	FEATURE_TELEGRAM_COMMAND_HANDLERS,
	FEATURE_TELEGRAM_EVENT_HOOKS,
	FEATURE_TELEGRAM_POLICY_HOOKS,
} from "../system/telegram/telegram.constants";
import type { TelegramCommandHandler, TelegramEventHook, TelegramPolicyHook } from "../system/telegram/telegram.types";
import { AppConfigService } from "../../shared/config/app-config.service";
import { TEMPLATE_STATUS_TELEGRAM_COMMAND_HANDLERS } from "./template-status/template-status.constants";
import { TemplateStatusFeatureModule } from "./template-status/template-status.module";

@Global()
@Module({
	imports: [TemplateStatusFeatureModule],
	providers: [
		{
			provide: FEATURE_TELEGRAM_COMMAND_HANDLERS,
			inject: [AppConfigService, TEMPLATE_STATUS_TELEGRAM_COMMAND_HANDLERS],
			useFactory: (
				config: AppConfigService,
				templateStatusHandlers: readonly TelegramCommandHandler[],
			): TelegramCommandHandler[] => {
				if (!config.isFeatureEnabled("template-status")) {
					return [];
				}
				return [...templateStatusHandlers];
			},
		},
		{
			provide: FEATURE_TELEGRAM_POLICY_HOOKS,
			useValue: [] satisfies TelegramPolicyHook[],
		},
		{
			provide: FEATURE_TELEGRAM_EVENT_HOOKS,
			useValue: [] satisfies TelegramEventHook[],
		},
	],
	exports: [FEATURE_TELEGRAM_COMMAND_HANDLERS, FEATURE_TELEGRAM_POLICY_HOOKS, FEATURE_TELEGRAM_EVENT_HOOKS],
})
export class FeaturesModule {}

import { Module } from "@nestjs/common";

import { IdentityModule } from "../identity/identity.module";
import { StartCommandHandler } from "./commands/start.command";
import { StatusCommandHandler } from "./commands/status.command";
import {
	FEATURE_TELEGRAM_COMMAND_HANDLERS,
	FEATURE_TELEGRAM_EVENT_HOOKS,
	FEATURE_TELEGRAM_POLICY_HOOKS,
	SYSTEM_TELEGRAM_COMMAND_HANDLERS,
	SYSTEM_TELEGRAM_EVENT_HOOKS,
	SYSTEM_TELEGRAM_POLICY_HOOKS,
	TELEGRAM_COMMAND_HANDLERS,
	TELEGRAM_EVENT_HOOKS,
	TELEGRAM_POLICY_HOOKS,
} from "./telegram.constants";
import type { TelegramCommandHandler, TelegramEventHook, TelegramPolicyHook } from "./telegram.types";
import { TelegramService } from "./telegram.service";
import { TelegramWebhookController } from "./webhook.controller";
import { AdminAccessPolicyHook } from "./policy/admin-access.policy-hook";
import { AllowlistPolicyHook } from "./policy/allowlist.policy-hook";
import { IdentityStatusPolicyHook } from "./policy/identity-status.policy-hook";
import { TelegramCommandRegistryService } from "./registry/command-registry.service";
import { LoggingTelegramEventHook } from "./hooks/logging-event-hook.service";
import { TelegramErrorResponderService } from "./telegram-error-responder.service";

@Module({
	imports: [IdentityModule],
	controllers: [TelegramWebhookController],
	providers: [
		StartCommandHandler,
		StatusCommandHandler,
		AllowlistPolicyHook,
		AdminAccessPolicyHook,
		IdentityStatusPolicyHook,
		LoggingTelegramEventHook,
		TelegramErrorResponderService,
		TelegramCommandRegistryService,
		TelegramService,
		{
			provide: SYSTEM_TELEGRAM_COMMAND_HANDLERS,
			inject: [StartCommandHandler, StatusCommandHandler],
			useFactory: (start: StartCommandHandler, status: StatusCommandHandler): TelegramCommandHandler[] => [
				start,
				status,
			],
		},
		{
			provide: SYSTEM_TELEGRAM_POLICY_HOOKS,
			inject: [AllowlistPolicyHook, AdminAccessPolicyHook, IdentityStatusPolicyHook],
			useFactory: (
				allowlistHook: AllowlistPolicyHook,
				adminAccessHook: AdminAccessPolicyHook,
				identityStatusHook: IdentityStatusPolicyHook,
			): TelegramPolicyHook[] => [allowlistHook, adminAccessHook, identityStatusHook],
		},
		{
			provide: SYSTEM_TELEGRAM_EVENT_HOOKS,
			inject: [LoggingTelegramEventHook],
			useFactory: (loggingHook: LoggingTelegramEventHook): TelegramEventHook[] => [loggingHook],
		},
		{
			provide: TELEGRAM_COMMAND_HANDLERS,
			inject: [SYSTEM_TELEGRAM_COMMAND_HANDLERS, FEATURE_TELEGRAM_COMMAND_HANDLERS],
			useFactory: (
				systemHandlers: readonly TelegramCommandHandler[],
				featureHandlers: readonly TelegramCommandHandler[],
			): TelegramCommandHandler[] => [...systemHandlers, ...featureHandlers],
		},
		{
			provide: TELEGRAM_POLICY_HOOKS,
			inject: [SYSTEM_TELEGRAM_POLICY_HOOKS, FEATURE_TELEGRAM_POLICY_HOOKS],
			useFactory: (
				systemHooks: readonly TelegramPolicyHook[],
				featureHooks: readonly TelegramPolicyHook[],
			): TelegramPolicyHook[] => [...systemHooks, ...featureHooks],
		},
		{
			provide: TELEGRAM_EVENT_HOOKS,
			inject: [SYSTEM_TELEGRAM_EVENT_HOOKS, FEATURE_TELEGRAM_EVENT_HOOKS],
			useFactory: (
				systemHooks: readonly TelegramEventHook[],
				featureHooks: readonly TelegramEventHook[],
			): TelegramEventHook[] => [...systemHooks, ...featureHooks],
		},
	],
	exports: [
		TelegramService,
		SYSTEM_TELEGRAM_COMMAND_HANDLERS,
		SYSTEM_TELEGRAM_POLICY_HOOKS,
		SYSTEM_TELEGRAM_EVENT_HOOKS,
		TELEGRAM_COMMAND_HANDLERS,
		TELEGRAM_POLICY_HOOKS,
		TELEGRAM_EVENT_HOOKS,
	],
})
export class TelegramModule {}

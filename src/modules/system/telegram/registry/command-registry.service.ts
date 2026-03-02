import { Inject, Injectable, Optional } from "@nestjs/common";
import { Bot } from "grammy";

import { AccessDeniedError } from "../../../../shared/application/errors/access-denied.error";
import { LOGGER_PORT, type LoggerPort } from "../../../../shared/application/ports/logger.port";
import { AppConfigService } from "../../../../shared/config/app-config.service";
import {
	TELEGRAM_COMMAND_HANDLERS,
	TELEGRAM_EVENT_HOOKS,
	TELEGRAM_POLICY_HOOKS,
} from "../telegram.constants";
import { TelegramErrorResponderService } from "../telegram-error-responder.service";
import type {
	TelegramBotContext,
	TelegramCommandHandler,
	TelegramCommandLifecycleEvent,
	TelegramEventHook,
	TelegramPolicyHook,
} from "../telegram.types";

@Injectable()
export class TelegramCommandRegistryService {
	constructor(
		@Inject(TELEGRAM_COMMAND_HANDLERS)
		private readonly handlers: readonly TelegramCommandHandler[],
		@Optional()
		@Inject(TELEGRAM_POLICY_HOOKS)
		private readonly policyHooks: readonly TelegramPolicyHook[] = [],
		@Optional()
		@Inject(TELEGRAM_EVENT_HOOKS)
		private readonly eventHooks: readonly TelegramEventHook[] = [],
		private readonly config: AppConfigService,
		private readonly errorResponder: TelegramErrorResponderService,
		@Inject(LOGGER_PORT) private readonly logger: LoggerPort,
	) {}

	register(bot: Bot<TelegramBotContext>): void {
		for (const handler of this.handlers) {
			if (handler.featureFlag && !this.config.isFeatureFlagEnabled(handler.featureFlag)) {
				this.logger.info("telegram_command_skipped_by_feature_flag", {
					command: handler.command,
					featureFlag: handler.featureFlag,
				});
				continue;
			}

			bot.command(handler.command, async (ctx) => {
				const event = this.toLifecycleEvent(handler.command, ctx);
				try {
					await this.runPolicyHooks(handler, ctx);
					await this.emitCommandReceived(event);
					await handler.execute(ctx);
					await this.emitCommandSucceeded(event);
				} catch (error) {
					const normalized = error instanceof Error ? error : new Error(String(error));
					await this.emitCommandFailed(event, normalized);
					await this.errorResponder.handle(ctx, handler.command, normalized);
				}
			});
			this.logger.info("telegram_command_registered", {
				command: handler.command,
				access: handler.access ?? "public",
				requiresIdentity: handler.requiresIdentity ?? false,
			});
		}

		bot.command("help", async (ctx) => {
			const available = this.handlers
				.filter((handler) => !handler.featureFlag || this.config.isFeatureFlagEnabled(handler.featureFlag))
				.map((handler) => `/${handler.command}`)
				.join(", ");
			await ctx.reply(`Available commands: ${available}`);
		});
	}

	private async runPolicyHooks(handler: TelegramCommandHandler, ctx: TelegramBotContext): Promise<void> {
		for (const hook of this.policyHooks) {
			const decision = await hook.evaluate({
				command: handler,
				ctx,
			});

			if (decision.allowed) {
				continue;
			}

				this.logger.warn("telegram_command_blocked_by_policy", {
					command: handler.command,
					policy: hook.name,
					reason: decision.reason ?? "policy denied command",
				});
			throw new AccessDeniedError(
				decision.reason ?? `Policy "${hook.name}" denied command`,
				decision.replyMessage ?? "This command is not available for your account.",
			);
		}
	}

	private async emitCommandReceived(event: TelegramCommandLifecycleEvent): Promise<void> {
		for (const hook of this.eventHooks) {
			await hook.onCommandReceived?.(event);
		}
	}

	private async emitCommandSucceeded(event: TelegramCommandLifecycleEvent): Promise<void> {
		for (const hook of this.eventHooks) {
			await hook.onCommandSucceeded?.(event);
		}
	}

	private async emitCommandFailed(event: TelegramCommandLifecycleEvent, error: Error): Promise<void> {
		for (const hook of this.eventHooks) {
			await hook.onCommandFailed?.({
				...event,
				error,
			});
		}
	}

	private toLifecycleEvent(command: string, ctx: TelegramBotContext): TelegramCommandLifecycleEvent {
		return {
			command,
			updateId: ctx.update.update_id,
			telegramId: ctx.from?.id,
		};
	}
}

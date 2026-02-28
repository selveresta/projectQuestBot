import { Inject, Injectable, Optional, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import { Bot, GrammyError, session } from "grammy";
import type { Update } from "grammy/types";

import {
	TELEGRAM_IDEMPOTENCY_PORT,
	type TelegramIdempotencyStorePort,
} from "../../../shared/application/ports/telegram-idempotency-store.port";
import {
	TELEGRAM_SESSION_STORE_PORT,
	type TelegramSessionStorePort,
} from "../../../shared/application/ports/telegram-session-store.port";
import { LOGGER_PORT, type LoggerPort } from "../../../shared/application/ports/logger.port";
import { RATE_LIMITER_PORT, type RateLimiterPort } from "../../../shared/application/ports/rate-limiter.port";
import { AppConfigService } from "../../../shared/config/app-config.service";
import { TelegramCommandRegistryService } from "./registry/command-registry.service";
import type { TelegramBotContext, TelegramSessionData } from "./telegram.types";

@Injectable()
export class TelegramService implements OnModuleInit, OnApplicationShutdown {
	private bot: Bot<TelegramBotContext> | null = null;
	private pollingPromise: Promise<void> | null = null;

	constructor(
		private readonly config: AppConfigService,
		private readonly commandRegistry: TelegramCommandRegistryService,
		@Inject(TELEGRAM_IDEMPOTENCY_PORT) private readonly idempotencyStore: TelegramIdempotencyStorePort,
		@Inject(RATE_LIMITER_PORT) private readonly rateLimiter: RateLimiterPort,
		@Inject(LOGGER_PORT) private readonly logger: LoggerPort,
		@Optional() @Inject(TELEGRAM_SESSION_STORE_PORT) private readonly sessionStore?: TelegramSessionStorePort,
	) {}

	async onModuleInit(): Promise<void> {
		const bot = this.createBot();
		this.bot = bot;
		this.commandRegistry.register(bot);

		if (this.config.telegramMode === "webhook") {
			await this.enableWebhookMode(bot);
			return;
		}
		await this.enablePollingMode(bot);
	}

	async onApplicationShutdown(): Promise<void> {
		const bot = this.bot;
		if (!bot) {
			return;
		}

		if (this.pollingPromise) {
			bot.stop();
			try {
				await this.pollingPromise;
			} catch {
				// already logged in polling error handler
			}
		}

		this.bot = null;
		this.pollingPromise = null;
	}

	async handleWebhookUpdate(update: Update): Promise<void> {
		const bot = this.requireBot();
		await bot.handleUpdate(update);
	}

	async sendTextMessage(chatId: number, text: string): Promise<void> {
		const bot = this.requireBot();
		await bot.api.sendMessage(chatId, text);
	}

	private createBot(): Bot<TelegramBotContext> {
		const bot = new Bot<TelegramBotContext>(this.config.telegramBotToken);

		if (this.config.telegramSessionEnabled && this.sessionStore) {
			bot.use(
				session({
					initial: (): TelegramSessionData => ({
						lastCommandAt: null,
					}),
					storage: this.sessionStore.createStorageAdapter<TelegramSessionData>(),
				}),
			);
		}

		bot.use(async (ctx, next) => {
			const isFresh = await this.idempotencyStore.acquire(ctx.update.update_id, this.config.idempotencyTtlSeconds);
			if (!isFresh) {
				this.logger.debug("telegram_duplicate_update_skipped", { updateId: ctx.update.update_id });
				return;
			}

			const rateDecision = await this.rateLimiter.consume({
				key: `rl:per-chat:${ctx.chat?.id ?? "unknown"}`,
				points: 1,
				durationSeconds: 1,
			});
			if (!rateDecision.allowed) {
				await ctx.reply("Too many requests. Please retry in a moment.");
				return;
			}

			await next();
		});

		bot.catch((error) => {
			const description =
				error.error instanceof GrammyError
					? error.error.description
					: error.error instanceof Error
						? error.error.message
						: "Unknown Telegram error";
			this.logger.error("telegram_update_failed", {
				updateId: error.ctx.update.update_id,
				description,
			});
		});

		return bot;
	}

	private async enablePollingMode(bot: Bot<TelegramBotContext>): Promise<void> {
		await bot.api.deleteWebhook({
			drop_pending_updates: this.config.telegramDropPendingUpdates,
		});

		const pollingPromise = bot.start({
			drop_pending_updates: this.config.telegramDropPendingUpdates,
			allowed_updates: this.config.telegramAllowedUpdates,
		});
		this.pollingPromise = pollingPromise;

		void pollingPromise.catch((error: unknown) => {
			this.logger.error("telegram_polling_stopped", {
				error: error instanceof Error ? error.message : String(error),
			});
		});

		this.logger.info("telegram_mode_polling_enabled");
	}

	private async enableWebhookMode(bot: Bot<TelegramBotContext>): Promise<void> {
		await bot.api.setWebhook(this.config.telegramWebhookEndpoint, {
			secret_token: this.config.telegramWebhookSecret,
			allowed_updates: this.config.telegramAllowedUpdates,
			drop_pending_updates: this.config.telegramDropPendingUpdates,
		});

		this.logger.info("telegram_mode_webhook_enabled", {
			path: this.config.telegramWebhookPath,
		});
	}

	private requireBot(): Bot<TelegramBotContext> {
		if (!this.bot) {
			throw new Error("Telegram bot is not initialized");
		}
		return this.bot;
	}
}

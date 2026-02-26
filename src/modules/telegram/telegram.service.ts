import { Inject, Injectable, Optional, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import { Bot, GrammyError, session } from "grammy";
import type { Update } from "grammy/types";

import { PinoLoggerService } from "../../common/logger/pino-logger.service";
import { AppConfigService } from "../config/app-config.service";
import type { IdempotencyRepositoryPort } from "./application/ports/idempotency-repository.port";
import type { RateLimiterPort } from "./application/ports/rate-limiter.port";
import type { SessionStorePort } from "./application/ports/session-store.port";
import { IDEMPOTENCY_REPOSITORY, RATE_LIMITER, SESSION_STORE } from "./telegram.constants";
import type { BotContext, BotSessionData } from "./telegram.types";
import { CommandRegistryService } from "./registry/command-registry.service";

@Injectable()
export class TelegramService implements OnModuleInit, OnApplicationShutdown {
	private bot: Bot<BotContext> | null = null;
	private pollingPromise: Promise<void> | null = null;

	constructor(
		private readonly config: AppConfigService,
		private readonly logger: PinoLoggerService,
		private readonly commandRegistry: CommandRegistryService,
		@Inject(IDEMPOTENCY_REPOSITORY) private readonly idempotencyRepository: IdempotencyRepositoryPort,
		@Inject(RATE_LIMITER) private readonly rateLimiter: RateLimiterPort,
		@Optional() @Inject(SESSION_STORE) private readonly sessionStore?: SessionStorePort,
	) {}

	async onModuleInit(): Promise<void> {
		const bot = this.createBot();
		this.bot = bot;
		this.commandRegistry.register(bot);

		if (this.config.isProduction()) {
			await this.enableWebhookMode(bot);
			return;
		}

		await this.enablePollingMode(bot);
	}

	async handleWebhookUpdate(update: Update): Promise<void> {
		const bot = this.requireBot();
		await bot.handleUpdate(update);
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
				// polling termination already logged in polling promise catch block
			}
		}

		this.bot = null;
		this.pollingPromise = null;
	}

	private createBot(): Bot<BotContext> {
		const bot = new Bot<BotContext>(this.config.telegramBotToken);

		if (this.config.telegramSessionEnabled && this.sessionStore) {
			bot.use(
				session({
					initial: (): BotSessionData => ({
						lastCommandAt: null,
					}),
					storage: this.sessionStore.createStorageAdapter<BotSessionData>(),
				}),
			);
		}

		bot.use(async (ctx, next) => {
			const isFreshUpdate = await this.idempotencyRepository.acquireUpdate(ctx.update.update_id);
			if (!isFreshUpdate) {
				this.logger.debug(`Skipped duplicated update ${ctx.update.update_id}`);
				return;
			}

			const allowed = await this.rateLimiter.allow({
				userId: ctx.from?.id,
				chatId: ctx.chat?.id,
			});
			if (!allowed) {
				await ctx.reply("Too many requests. Please try again shortly.");
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
			this.logger.error("Telegram update handling failed", {
				updateId: error.ctx.update.update_id,
				description,
			});
		});

		return bot;
	}

	private async enablePollingMode(bot: Bot<BotContext>): Promise<void> {
		await bot.api.deleteWebhook({
			drop_pending_updates: this.config.telegramDropPendingUpdates,
		});

		const pollingPromise = bot.start({
			drop_pending_updates: this.config.telegramDropPendingUpdates,
			allowed_updates: this.config.telegramAllowedUpdates,
		});
		this.pollingPromise = pollingPromise;

		void pollingPromise.catch((error: unknown) => {
			this.logger.error("Telegram polling stopped unexpectedly", error);
		});

		this.logger.log("Telegram bot started in polling mode");
	}

	private async enableWebhookMode(bot: Bot<BotContext>): Promise<void> {
		await bot.api.setWebhook(this.config.telegramWebhookEndpoint, {
			secret_token: this.config.telegramWebhookSecret,
			allowed_updates: this.config.telegramAllowedUpdates,
			drop_pending_updates: this.config.telegramDropPendingUpdates,
		});

		this.logger.log(`Telegram bot started in webhook mode on ${this.config.telegramWebhookPath}`);
	}

	private requireBot(): Bot<BotContext> {
		if (!this.bot) {
			throw new Error("Telegram bot is not initialized");
		}
		return this.bot;
	}
}

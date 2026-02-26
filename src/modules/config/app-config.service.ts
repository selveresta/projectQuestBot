import { Injectable } from "@nestjs/common";
import { config as loadEnv } from "dotenv";
import type { Update } from "grammy/types";
import type { LevelWithSilent } from "pino";

import { EnvSchema, type AppEnv } from "./env.schema";

const TELEGRAM_WEBHOOK_PATH = "/telegram/webhook";
loadEnv();

@Injectable()
export class AppConfigService {
	private readonly env: AppEnv;

	constructor() {
		const parsed = EnvSchema.safeParse(process.env);
		if (!parsed.success) {
			throw new Error(`Environment validation failed: ${parsed.error.message}`);
		}

		this.env = parsed.data;
		if (this.isProduction()) {
			if (!this.env.TELEGRAM_WEBHOOK_URL) {
				throw new Error("TELEGRAM_WEBHOOK_URL is required in production mode");
			}
			if (!this.env.TELEGRAM_WEBHOOK_SECRET) {
				throw new Error("TELEGRAM_WEBHOOK_SECRET is required in production mode");
			}
		}
	}

	get nodeEnv(): "development" | "production" {
		return this.env.NODE_ENV;
	}

	get httpPort(): number {
		return this.env.PORT;
	}

	get telegramBotToken(): string {
		return this.env.BOT_TOKEN;
	}

	get redisUrl(): string {
		return this.env.REDIS_URL;
	}

	get telegramWebhookPath(): string {
		return TELEGRAM_WEBHOOK_PATH;
	}

	get telegramWebhookSecret(): string {
		return this.env.TELEGRAM_WEBHOOK_SECRET ?? "";
	}

	get telegramWebhookEndpoint(): string {
		const base = this.env.TELEGRAM_WEBHOOK_URL;
		if (!base) {
			return "";
		}
		return `${base.replace(/\/+$/, "")}${TELEGRAM_WEBHOOK_PATH}`;
	}

	get telegramAllowedUpdates(): ReadonlyArray<Exclude<keyof Update, "update_id">> {
		return ["message", "callback_query"];
	}

	get telegramDropPendingUpdates(): boolean {
		return this.env.TELEGRAM_DROP_PENDING_UPDATES;
	}

	get telegramSessionEnabled(): boolean {
		return this.env.TELEGRAM_SESSION_ENABLED;
	}

	get idempotencyTtlSeconds(): number {
		return this.env.IDEMPOTENCY_TTL_SECONDS;
	}

	get referralPoints(): number {
		return this.env.REFERRAL_POINTS;
	}

	get logLevel(): LevelWithSilent {
		return this.env.LOG_LEVEL;
	}

	get telegramMode(): "polling" | "webhook" {
		return this.isProduction() ? "webhook" : "polling";
	}

	isProduction(): boolean {
		return this.env.NODE_ENV === "production";
	}
}

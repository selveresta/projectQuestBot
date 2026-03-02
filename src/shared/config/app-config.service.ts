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
		if (this.env.PRIMARY_DB === "postgres" && !this.env.DATABASE_URL) {
			throw new Error("DATABASE_URL is required when PRIMARY_DB=postgres");
		}
	}

	get nodeEnv(): "development" | "production" {
		return this.env.NODE_ENV;
	}

	get httpPort(): number {
		return this.env.PORT;
	}

	get telegramBotToken(): string {
		return this.env.TELEGRAM_BOT_TOKEN;
	}

	get redisUrl(): string {
		return this.env.REDIS_URL;
	}

	get postgresUrl(): string | undefined {
		return this.env.DATABASE_URL;
	}

	get postgresPoolMin(): number {
		return this.env.POSTGRES_POOL_MIN;
	}

	get postgresPoolMax(): number {
		return this.env.POSTGRES_POOL_MAX;
	}

	get amqpUrl(): string {
		return this.env.AMQP_URL;
	}

	get brokerEnabled(): boolean {
		return this.env.BROKER_ENABLED;
	}

	get primaryDb(): "redis" | "postgres" {
		return this.env.PRIMARY_DB;
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

	get telegramAllowlistIds(): readonly number[] {
		return parseNumericList(this.env.TELEGRAM_ALLOWLIST_IDS);
	}

	get telegramAdminIds(): readonly number[] {
		return parseNumericList(this.env.TELEGRAM_ADMIN_IDS);
	}

	get enabledFeatures(): ReadonlySet<string> {
		return new Set<string>(parseStringList(this.env.FEATURES_ENABLED));
	}

	isFeatureEnabled(featureName: string): boolean {
		return this.enabledFeatures.has(featureName);
	}

	isFeatureFlagEnabled(featureFlag: string): boolean {
		switch (featureFlag) {
			case "feature.template-ping":
				return this.env.FEATURE_TEMPLATE_PING_ENABLED;
			case "feature.template-admin-status":
				return this.env.FEATURE_TEMPLATE_ADMIN_STATUS_ENABLED;
			default:
				return parseStringList(this.env.FEATURES_ENABLED).includes(featureFlag);
		}
	}

	get idempotencyTtlSeconds(): number {
		return this.env.IDEMPOTENCY_TTL_SECONDS;
	}

	get broadcastExchange(): string {
		return this.env.BROADCAST_EXCHANGE;
	}

	get broadcastChunkQueue(): string {
		return this.env.BROADCAST_CHUNK_QUEUE;
	}

	get broadcastRetryQueue(): string {
		return this.env.BROADCAST_RETRY_QUEUE;
	}

	get broadcastDlqQueue(): string {
		return this.env.BROADCAST_DLQ_QUEUE;
	}

	get broadcastChunkSize(): number {
		return this.env.BROADCAST_CHUNK_SIZE;
	}

	get broadcastPrefetch(): number {
		return this.env.BROADCAST_PREFETCH;
	}

	get broadcastConcurrency(): number {
		return this.env.BROADCAST_CONCURRENCY;
	}

	get broadcastRetryMaxAttempts(): number {
		return this.env.BROADCAST_RETRY_MAX_ATTEMPTS;
	}

	get broadcastRetryBaseDelayMs(): number {
		return this.env.BROADCAST_RETRY_BASE_DELAY_MS;
	}

	get broadcastRetryMaxDelayMs(): number {
		return this.env.BROADCAST_RETRY_MAX_DELAY_MS;
	}

	get broadcastIdempotencyTtlSeconds(): number {
		return this.env.BROADCAST_IDEMPOTENCY_TTL_SECONDS;
	}

	get broadcastGlobalRateLimitPoints(): number {
		return this.env.BROADCAST_GLOBAL_RATE_LIMIT_POINTS;
	}

	get broadcastGlobalRateLimitDurationSeconds(): number {
		return this.env.BROADCAST_GLOBAL_RATE_LIMIT_DURATION_SECONDS;
	}

	get broadcastRecoveryBatchSize(): number {
		return this.env.BROADCAST_RECOVERY_BATCH_SIZE;
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

function parseStringList(raw: string): string[] {
	return raw
		.split(",")
		.map((value) => value.trim())
		.filter((value) => value.length > 0);
}

function parseNumericList(raw: string): number[] {
	return parseStringList(raw)
		.map((value) => Number.parseInt(value, 10))
		.filter((value) => Number.isSafeInteger(value) && value > 0);
}

import { z } from "zod";

const BooleanFromStringSchema = z.preprocess((value: unknown) => {
	if (typeof value === "boolean") {
		return value;
	}
	if (typeof value !== "string") {
		return value;
	}

	const normalized = value.trim().toLowerCase();
	if (["1", "true", "yes", "on"].includes(normalized)) {
		return true;
	}
	if (["0", "false", "no", "off"].includes(normalized)) {
		return false;
	}
	return value;
}, z.boolean());

export const EnvSchema = z.object({
	NODE_ENV: z.enum(["development", "production"]).default("development"),
	PORT: z.coerce.number().int().positive().default(3000),
	BOT_TOKEN: z.string().min(1),
	PRIMARY_DB: z.enum(["redis", "postgres"]).default("redis"),
	REDIS_URL: z.string().min(1).default("redis://127.0.0.1:6379"),
	POSTGRES_URL: z.string().min(1).optional(),
	AMQP_URL: z.string().min(1).default("amqp://127.0.0.1:5672"),
	TELEGRAM_WEBHOOK_URL: z.string().url().optional(),
	TELEGRAM_WEBHOOK_SECRET: z.string().min(8).optional(),
	TELEGRAM_DROP_PENDING_UPDATES: BooleanFromStringSchema.default(true),
	TELEGRAM_SESSION_ENABLED: BooleanFromStringSchema.default(false),
	IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
	BROADCAST_EXCHANGE: z.string().min(1).default("broadcast.exchange"),
	BROADCAST_CHUNK_QUEUE: z.string().min(1).default("broadcast.chunk"),
	BROADCAST_RETRY_QUEUE: z.string().min(1).default("broadcast.chunk.retry"),
	BROADCAST_DLQ_QUEUE: z.string().min(1).default("broadcast.chunk.dlq"),
	BROADCAST_CHUNK_SIZE: z.coerce.number().int().positive().max(1000).default(100),
	BROADCAST_PREFETCH: z.coerce.number().int().positive().default(20),
	BROADCAST_CONCURRENCY: z.coerce.number().int().positive().default(2),
	BROADCAST_RETRY_MAX_ATTEMPTS: z.coerce.number().int().positive().max(20).default(5),
	BROADCAST_RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().default(1000),
	BROADCAST_RETRY_MAX_DELAY_MS: z.coerce.number().int().positive().default(30000),
	BROADCAST_IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().positive().default(2592000),
	BROADCAST_GLOBAL_RATE_LIMIT_POINTS: z.coerce.number().int().positive().default(20),
	BROADCAST_GLOBAL_RATE_LIMIT_DURATION_SECONDS: z.coerce.number().int().positive().default(1),
	BROADCAST_RECOVERY_BATCH_SIZE: z.coerce.number().int().positive().max(500).default(50),
	LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

export type AppEnv = z.infer<typeof EnvSchema>;

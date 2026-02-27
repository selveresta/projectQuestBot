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
	TELEGRAM_WEBHOOK_URL: z.string().url().optional(),
	TELEGRAM_WEBHOOK_SECRET: z.string().min(8).optional(),
	TELEGRAM_DROP_PENDING_UPDATES: BooleanFromStringSchema.default(true),
	TELEGRAM_SESSION_ENABLED: BooleanFromStringSchema.default(false),
	IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
	LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

export type AppEnv = z.infer<typeof EnvSchema>;

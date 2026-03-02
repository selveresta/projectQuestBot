import { Global, Module } from "@nestjs/common";

import { RedisCacheAdapter } from "./adapters/cache/redis-cache.adapter";
import { SystemClockAdapter } from "./adapters/clock/system-clock.adapter";
import { RedisIdempotencyKeyAdapter } from "./adapters/idempotency/redis-idempotency-key.adapter";
import { RedisRateLimiterAdapter } from "./adapters/rate-limit/redis-rate-limiter.adapter";
import { NoopTransactionManagerAdapter } from "./adapters/transaction/noop-transaction-manager.adapter";
import { PostgresTransactionManagerAdapter } from "./adapters/transaction/postgres-transaction-manager.adapter";
import { RedisTelegramIdempotencyStoreAdapter } from "./adapters/telegram/redis-idempotency-store.adapter";
import { RedisTelegramSessionStoreAdapter } from "./adapters/telegram/redis-session-store.adapter";
import { RandomIdGeneratorAdapter } from "./adapters/id-generator/random-id-generator.adapter";
import { NestLoggerAdapter } from "./adapters/logger/nest-logger.adapter";
import { CACHE_PORT } from "./application/ports/cache.port";
import { CLOCK_PORT } from "./application/ports/clock.port";
import { ID_GENERATOR_PORT } from "./application/ports/id-generator.port";
import { IDEMPOTENCY_KEY_PORT } from "./application/ports/idempotency-key.port";
import { LOGGER_PORT } from "./application/ports/logger.port";
import { RATE_LIMITER_PORT } from "./application/ports/rate-limiter.port";
import { TELEGRAM_IDEMPOTENCY_PORT } from "./application/ports/telegram-idempotency-store.port";
import { TELEGRAM_SESSION_STORE_PORT } from "./application/ports/telegram-session-store.port";
import { TRANSACTION_MANAGER_PORT } from "./application/ports/transaction-manager.port";
import { AppConfigService } from "./config/app-config.service";
import { PostgresModule } from "./persistence/postgres/postgres.module";
import { RedisModule } from "./persistence/redis/redis.module";

@Global()
@Module({
	imports: [RedisModule, PostgresModule],
	providers: [
		RedisCacheAdapter,
		RedisRateLimiterAdapter,
		RedisIdempotencyKeyAdapter,
		SystemClockAdapter,
		RandomIdGeneratorAdapter,
		NestLoggerAdapter,
		NoopTransactionManagerAdapter,
		PostgresTransactionManagerAdapter,
		RedisTelegramIdempotencyStoreAdapter,
		RedisTelegramSessionStoreAdapter,
		{
			provide: CACHE_PORT,
			useExisting: RedisCacheAdapter,
		},
		{
			provide: RATE_LIMITER_PORT,
			useExisting: RedisRateLimiterAdapter,
		},
		{
			provide: CLOCK_PORT,
			useExisting: SystemClockAdapter,
		},
		{
			provide: ID_GENERATOR_PORT,
			useExisting: RandomIdGeneratorAdapter,
		},
		{
			provide: IDEMPOTENCY_KEY_PORT,
			useExisting: RedisIdempotencyKeyAdapter,
		},
		{
			provide: LOGGER_PORT,
			useExisting: NestLoggerAdapter,
		},
		{
			provide: TRANSACTION_MANAGER_PORT,
			inject: [AppConfigService, NoopTransactionManagerAdapter, PostgresTransactionManagerAdapter],
			useFactory: (
				config: AppConfigService,
				noopManager: NoopTransactionManagerAdapter,
				postgresManager: PostgresTransactionManagerAdapter,
			): NoopTransactionManagerAdapter | PostgresTransactionManagerAdapter =>
				config.primaryDb === "postgres" ? postgresManager : noopManager,
		},
		{
			provide: TELEGRAM_IDEMPOTENCY_PORT,
			useExisting: RedisTelegramIdempotencyStoreAdapter,
		},
		{
			provide: TELEGRAM_SESSION_STORE_PORT,
			useExisting: RedisTelegramSessionStoreAdapter,
		},
	],
	exports: [
		CACHE_PORT,
		RATE_LIMITER_PORT,
		CLOCK_PORT,
		ID_GENERATOR_PORT,
		IDEMPOTENCY_KEY_PORT,
		LOGGER_PORT,
		TRANSACTION_MANAGER_PORT,
		TELEGRAM_IDEMPOTENCY_PORT,
		TELEGRAM_SESSION_STORE_PORT,
	],
})
export class SharedModule {}

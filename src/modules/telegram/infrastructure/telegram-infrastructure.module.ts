import { Module } from "@nestjs/common";

import type { IdempotencyRepositoryPort } from "../application/ports/idempotency-repository.port";
import type { RateLimiterPort } from "../application/ports/rate-limiter.port";
import type { SessionStorePort } from "../application/ports/session-store.port";
import type { UserRepositoryPort } from "../application/ports/user-repository.port";
import {
	IDEMPOTENCY_REPOSITORY,
	RATE_LIMITER,
	REDIS_CLIENT,
	SESSION_STORE,
	USER_REPOSITORY,
} from "../telegram.constants";
import { NoopRateLimiterService } from "./noop-rate-limiter.service";
import { RedisClientLifecycleService } from "./redis-client-lifecycle.service";
import { RedisIdempotencyRepository } from "./redis-idempotency.repository";
import { redisClientProvider } from "./redis.provider";
import { RedisSessionStore } from "./redis-session.store";
import { RedisUserRepository } from "./redis-user.repository";

@Module({
	providers: [
		redisClientProvider,
		RedisClientLifecycleService,
		RedisUserRepository,
		RedisIdempotencyRepository,
		RedisSessionStore,
		NoopRateLimiterService,
		{
			provide: USER_REPOSITORY,
			useExisting: RedisUserRepository,
		} satisfies { provide: symbol; useExisting: typeof RedisUserRepository },
		{
			provide: IDEMPOTENCY_REPOSITORY,
			useExisting: RedisIdempotencyRepository,
		} satisfies { provide: symbol; useExisting: typeof RedisIdempotencyRepository },
		{
			provide: SESSION_STORE,
			useExisting: RedisSessionStore,
		} satisfies { provide: symbol; useExisting: typeof RedisSessionStore },
		{
			provide: RATE_LIMITER,
			useExisting: NoopRateLimiterService,
		} satisfies { provide: symbol; useExisting: typeof NoopRateLimiterService },
	],
	exports: [
		REDIS_CLIENT,
		USER_REPOSITORY,
		IDEMPOTENCY_REPOSITORY,
		SESSION_STORE,
		RATE_LIMITER,
	] satisfies Array<symbol>,
})
export class TelegramInfrastructureModule {}

export type { UserRepositoryPort, IdempotencyRepositoryPort, SessionStorePort, RateLimiterPort };

import { Inject, Injectable } from "@nestjs/common";

import type {
	RateLimitDecision,
	RateLimiterConsumeInput,
	RateLimiterPort,
} from "../../application/ports/rate-limiter.port";
import { REDIS_CLIENT } from "../../persistence/redis/redis.constants";
import type { RedisClient } from "../../persistence/redis/redis.provider";

@Injectable()
export class RedisRateLimiterAdapter implements RateLimiterPort {
	constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}

	async consume(input: RateLimiterConsumeInput): Promise<RateLimitDecision> {
		if (input.points <= 0) {
			throw new Error("Rate limiter limit points must be greater than zero");
		}
		if (input.durationSeconds <= 0) {
			throw new Error("Rate limiter duration must be greater than zero");
		}

		const nextCount = await this.redis.incrBy(input.key, 1);
		if (nextCount === 1) {
			await this.redis.expire(input.key, input.durationSeconds);
		}

		const ttlSeconds = await this.redis.ttl(input.key);
		const nowEpochSeconds = Math.floor(Date.now() / 1000);
		const resetAtEpochSeconds = ttlSeconds > 0 ? nowEpochSeconds + ttlSeconds : nowEpochSeconds + input.durationSeconds;
		const remaining = Math.max(0, input.points - nextCount);

		return {
			allowed: nextCount <= input.points,
			remaining,
			resetAtEpochSeconds,
		};
	}
}

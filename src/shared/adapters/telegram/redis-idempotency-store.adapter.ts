import { Inject, Injectable } from "@nestjs/common";

import type { TelegramIdempotencyStorePort } from "../../application/ports/telegram-idempotency-store.port";
import { REDIS_CLIENT } from "../../persistence/redis/redis.constants";
import { RedisKeys } from "../../persistence/redis/redis-key.schema";
import type { RedisClient } from "../../persistence/redis/redis.provider";

@Injectable()
export class RedisTelegramIdempotencyStoreAdapter implements TelegramIdempotencyStorePort {
	constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}

	async acquire(updateId: number, ttlSeconds: number): Promise<boolean> {
		const result = await this.redis.set(RedisKeys.telegram.idempotency(updateId), "1", {
			EX: ttlSeconds,
			NX: true,
		});
		return result === "OK";
	}
}

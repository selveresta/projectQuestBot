import { Inject, Injectable } from "@nestjs/common";

import type { IdempotencyKeyPort } from "../../application/ports/idempotency-key.port";
import { REDIS_CLIENT } from "../../persistence/redis/redis.constants";
import type { RedisClient } from "../../persistence/redis/redis.provider";

@Injectable()
export class RedisIdempotencyKeyAdapter implements IdempotencyKeyPort {
	constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}

	async acquire(key: string, ttlSeconds: number): Promise<boolean> {
		const result = await this.redis.set(key, "1", {
			EX: ttlSeconds,
			NX: true,
		});
		return result === "OK";
	}

	async release(key: string): Promise<void> {
		await this.redis.del(key);
	}
}

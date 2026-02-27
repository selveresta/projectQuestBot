import { Inject, Injectable } from "@nestjs/common";

import type { CachePort } from "../../application/ports/cache.port";
import { REDIS_CLIENT } from "../../persistence/redis/redis.constants";
import type { RedisClient } from "../../persistence/redis/redis.provider";

@Injectable()
export class RedisCacheAdapter implements CachePort {
	constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}

	async get<T>(key: string): Promise<T | null> {
		const payload = await this.redis.get(key);
		if (!payload) {
			return null;
		}

		try {
			return JSON.parse(payload) as T;
		} catch {
			return null;
		}
	}

	async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
		if (ttlSeconds <= 0) {
			throw new Error("Cache TTL must be greater than zero");
		}
		await this.redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
	}

	async del(key: string): Promise<void> {
		await this.redis.del(key);
	}

	async wrap<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
		const cached = await this.get<T>(key);
		if (cached !== null) {
			return cached;
		}

		const computed = await factory();
		await this.set(key, computed, ttlSeconds);
		return computed;
	}
}

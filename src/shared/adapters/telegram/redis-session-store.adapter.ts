import { Inject, Injectable } from "@nestjs/common";
import type { StorageAdapter } from "grammy";

import type { TelegramSessionStorePort } from "../../application/ports/telegram-session-store.port";
import { REDIS_CLIENT } from "../../persistence/redis/redis.constants";
import { RedisKeys } from "../../persistence/redis/redis-key.schema";
import type { RedisClient } from "../../persistence/redis/redis.provider";

@Injectable()
export class RedisTelegramSessionStoreAdapter implements TelegramSessionStorePort {
	constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}

	createStorageAdapter<TSession extends object>(): StorageAdapter<TSession> {
		return {
			read: async (sessionId: string): Promise<TSession | undefined> => {
				const payload = await this.redis.get(RedisKeys.telegram.session(sessionId));
				if (!payload) {
					return undefined;
				}
				try {
					return JSON.parse(payload) as TSession;
				} catch {
					return undefined;
				}
			},
			write: async (sessionId: string, value: TSession): Promise<void> => {
				await this.redis.set(RedisKeys.telegram.session(sessionId), JSON.stringify(value));
			},
			delete: async (sessionId: string): Promise<void> => {
				await this.redis.del(RedisKeys.telegram.session(sessionId));
			},
		};
	}
}

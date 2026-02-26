import { Inject, Injectable } from "@nestjs/common";
import type { StorageAdapter } from "grammy";

import type { SessionStorePort } from "../application/ports/session-store.port";
import { REDIS_CLIENT } from "../telegram.constants";
import type { RedisClient } from "./redis.provider";

@Injectable()
export class RedisSessionStore implements SessionStorePort {
	constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}

	createStorageAdapter<TSession extends object>(): StorageAdapter<TSession> {
		return {
			read: async (key: string): Promise<TSession | undefined> => {
				const payload = await this.redis.get(this.key(key));
				if (!payload) {
					return undefined;
				}
				try {
					return JSON.parse(payload) as TSession;
				} catch {
					return undefined;
				}
			},
			write: async (key: string, value: TSession): Promise<void> => {
				await this.redis.set(this.key(key), JSON.stringify(value));
			},
			delete: async (key: string): Promise<void> => {
				await this.redis.del(this.key(key));
			},
		};
	}

	private key(key: string): string {
		return `telegram:session:${key}`;
	}
}

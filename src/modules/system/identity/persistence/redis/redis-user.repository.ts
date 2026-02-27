import { Inject, Injectable } from "@nestjs/common";

import type { UserRepositoryPort } from "../../application/ports/user-repository.port";
import type { UserEntity } from "../../domain/entities/user.entity";
import type { TelegramUserId } from "../../domain/value-objects/telegram-user-id";
import type { UserId } from "../../domain/value-objects/user-id";
import { redisHashToUser, userToRedisHash } from "../mappers/user.mapper";
import { REDIS_CLIENT } from "../../../../../shared/persistence/redis/redis.constants";
import { RedisKeys } from "../../../../../shared/persistence/redis/redis-key.schema";
import type { RedisClient } from "../../../../../shared/persistence/redis/redis.provider";

@Injectable()
export class RedisUserRepository implements UserRepositoryPort {
	constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}

	async getById(id: UserId): Promise<UserEntity | null> {
		const hash = await this.redis.hGetAll(RedisKeys.user.entity(id));
		if (!hash.id) {
			return null;
		}
		return redisHashToUser(hash);
	}

	async findByTelegramId(telegramUserId: TelegramUserId): Promise<UserEntity | null> {
		const userIdRaw = await this.redis.get(RedisKeys.user.telegramIndex(telegramUserId));
		if (!userIdRaw) {
			return null;
		}
		return this.getById(userIdRaw as UserId);
	}

	async save(user: UserEntity): Promise<void> {
		const hash = userToRedisHash(user);
		const userKey = RedisKeys.user.entity(user.id);
		const telegramKey = RedisKeys.user.telegramIndex(user.telegramUserId);

		await this.redis
			.multi()
			.hSet(userKey, hash as Record<string, string>)
			.set(telegramKey, user.id)
			.exec();
	}

	async delete(id: UserId): Promise<void> {
		const existing = await this.getById(id);
		if (!existing) {
			return;
		}

		await this.redis
			.multi()
			.del(RedisKeys.user.entity(id))
			.del(RedisKeys.user.telegramIndex(existing.telegramUserId))
			.exec();
	}

	async listByIds(ids: readonly UserId[]): Promise<UserEntity[]> {
		const users: UserEntity[] = [];
		for (const id of ids) {
			const user = await this.getById(id);
			if (user) {
				users.push(user);
			}
		}
		return users;
	}
}

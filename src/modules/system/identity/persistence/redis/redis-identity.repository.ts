import { Inject, Injectable } from "@nestjs/common";

import type { IdentityRepositoryPort } from "../../application/ports/identity-repository.port";
import type { IdentityEntity } from "../../domain/entities/identity.entity";
import type { TelegramIdentityId } from "../../domain/value-objects/telegram-identity-id";
import type { IdentityId } from "../../domain/value-objects/identity-id";
import { redisHashToIdentity, identityToRedisHash } from "../mappers/identity.mapper";
import { REDIS_CLIENT } from "../../../../../shared/persistence/redis/redis.constants";
import { RedisKeys } from "../../../../../shared/persistence/redis/redis-key.schema";
import type { RedisClient } from "../../../../../shared/persistence/redis/redis.provider";

@Injectable()
export class RedisIdentityRepository implements IdentityRepositoryPort {
	constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}

	async getById(id: IdentityId): Promise<IdentityEntity | null> {
		const hash = await this.redis.hGetAll(RedisKeys.identity.entity(id));
		if (!hash.id) {
			return null;
		}
		return redisHashToIdentity(hash);
	}

	async findByTelegramId(telegramIdentityId: TelegramIdentityId): Promise<IdentityEntity | null> {
		const identityIdRaw = await this.redis.get(RedisKeys.identity.telegramIndex(telegramIdentityId));
		if (!identityIdRaw) {
			return null;
		}
		return this.getById(identityIdRaw as IdentityId);
	}

	async save(identity: IdentityEntity): Promise<void> {
		const hash = identityToRedisHash(identity);
		const identityKey = RedisKeys.identity.entity(identity.id);
		const telegramKey = RedisKeys.identity.telegramIndex(identity.telegramIdentityId);

		await this.redis
			.multi()
			.hSet(identityKey, hash as Record<string, string>)
			.set(telegramKey, identity.id)
			.exec();
	}

	async delete(id: IdentityId): Promise<void> {
		const existing = await this.getById(id);
		if (!existing) {
			return;
		}

		await this.redis
			.multi()
			.del(RedisKeys.identity.entity(id))
			.del(RedisKeys.identity.telegramIndex(existing.telegramIdentityId))
			.exec();
	}

	async listByIds(ids: readonly IdentityId[]): Promise<IdentityEntity[]> {
		const identities: IdentityEntity[] = [];
		for (const id of ids) {
			const identity = await this.getById(id);
			if (identity) {
				identities.push(identity);
			}
		}
		return identities;
	}
}

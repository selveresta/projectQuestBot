import { Inject, Injectable } from "@nestjs/common";

import type {
	IdentityCursorPage,
	IdentityCursorPageInput,
	IdentityRepositoryPort,
} from "../../application/ports/identity-repository.port";
import type { IdentityEntity } from "../../domain/entities/identity.entity";
import type { TelegramIdentityId } from "../../domain/value-objects/telegram-identity-id";
import type { IdentityId } from "../../domain/value-objects/identity-id";
import { redisHashToIdentity, identityToRedisHash } from "../mappers/identity.mapper";
import { REDIS_CLIENT } from "../../../../../shared/persistence/redis/redis.constants";
import { RedisKeys } from "../../../../../shared/persistence/redis/redis-key.schema";
import type { RedisClient } from "../../../../../shared/persistence/redis/redis.provider";

@Injectable()
export class RedisIdentityRepository implements IdentityRepositoryPort {
	private indexEnsured = false;

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

	async listByCursor(input: IdentityCursorPageInput): Promise<IdentityCursorPage> {
		const limit = Math.max(1, input.limit);
		await this.ensureIndexSeeded();

		const normalizedPrefix = input.usernamePrefix?.trim().toLowerCase();
		let scanCursor = input.cursor ?? "0";
		const items: IdentityEntity[] = [];
		let iterations = 0;

		while (items.length < limit && iterations < 200) {
			const scan = await this.redis.sScan(RedisKeys.identity.index, scanCursor, { COUNT: Math.max(limit * 4, 100) });
			scanCursor = scan.cursor;

			for (const member of scan.members) {
				const identity = await this.getById(member as IdentityId);
				if (!identity) {
					continue;
				}

				if (normalizedPrefix) {
					const username = identity.toSnapshot().username?.toLowerCase() ?? "";
					if (!username.startsWith(normalizedPrefix)) {
						continue;
					}
				}

				items.push(identity);
				if (items.length >= limit) {
					break;
				}
			}

			iterations += 1;
			if (scanCursor === "0") {
				break;
			}
		}

		return {
			items,
			nextCursor: scanCursor === "0" ? undefined : scanCursor,
		};
	}

	async countByUsernamePrefix(usernamePrefix?: string): Promise<number> {
		await this.ensureIndexSeeded();

		const normalizedPrefix = usernamePrefix?.trim().toLowerCase();
		if (!normalizedPrefix) {
			return this.redis.sCard(RedisKeys.identity.index);
		}

		let cursor = "0";
		let count = 0;
		let iterations = 0;

		while (iterations < 10000) {
			const scan = await this.redis.sScan(RedisKeys.identity.index, cursor, { COUNT: 500 });
			cursor = scan.cursor;

			for (const member of scan.members) {
				const identity = await this.getById(member as IdentityId);
				if (!identity) {
					continue;
				}
				const username = identity.toSnapshot().username?.toLowerCase() ?? "";
				if (username.startsWith(normalizedPrefix)) {
					count += 1;
				}
			}

			iterations += 1;
			if (cursor === "0") {
				break;
			}
		}

		return count;
	}

	async save(identity: IdentityEntity): Promise<void> {
		const hash = identityToRedisHash(identity);
		const identityKey = RedisKeys.identity.entity(identity.id);
		const telegramKey = RedisKeys.identity.telegramIndex(identity.telegramIdentityId);

		await this.redis
			.multi()
			.hSet(identityKey, hash as Record<string, string>)
			.set(telegramKey, identity.id)
			.sAdd(RedisKeys.identity.index, identity.id)
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
			.sRem(RedisKeys.identity.index, id)
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

	private async ensureIndexSeeded(): Promise<void> {
		if (this.indexEnsured) {
			return;
		}

		const indexSize = await this.redis.sCard(RedisKeys.identity.index);
		if (indexSize > 0) {
			this.indexEnsured = true;
			return;
		}

		let scanCursor = "0";
		let iterations = 0;
		do {
			const scan = await this.redis.scan(scanCursor, { MATCH: "identity:*", COUNT: 500 });
			scanCursor = scan.cursor;

			const ids = scan.keys
				.filter((key) => !key.startsWith("identity:tg:"))
				.map((key) => key.slice("identity:".length))
				.filter((key) => key.length > 0);
			if (ids.length > 0) {
				await this.redis.sAdd(RedisKeys.identity.index, ids);
			}

			iterations += 1;
		} while (scanCursor !== "0" && iterations < 10000);

		this.indexEnsured = true;
	}
}

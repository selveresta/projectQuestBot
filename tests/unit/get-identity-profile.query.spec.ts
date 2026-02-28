import test from "node:test";
import assert from "node:assert/strict";

import {
	GetIdentityProfileQuery,
	GetIdentityProfileQueryHandler,
} from "../../src/modules/system/identity/application/queries/get-identity-profile.query";
import type { IdentityRepositoryPort } from "../../src/modules/system/identity/application/ports/identity-repository.port";
import { IdentityEntity } from "../../src/modules/system/identity/domain/entities/identity.entity";
import { toTelegramIdentityId } from "../../src/modules/system/identity/domain/value-objects/telegram-identity-id";
import { toIdentityId } from "../../src/modules/system/identity/domain/value-objects/identity-id";
import type { CachePort } from "../../src/shared/application/ports/cache.port";
import type { RateLimiterPort } from "../../src/shared/application/ports/rate-limiter.port";
import { toIsoDateString } from "../../src/shared/domain/iso-date";

class InMemoryIdentityRepository implements IdentityRepositoryPort {
	private readonly identitiesById = new Map<string, IdentityEntity>();
	private readonly identitiesByTelegram = new Map<number, string>();

	async getById(id: ReturnType<typeof toIdentityId>): Promise<IdentityEntity | null> {
		return this.identitiesById.get(id) ?? null;
	}

	async findByTelegramId(telegramIdentityId: ReturnType<typeof toTelegramIdentityId>): Promise<IdentityEntity | null> {
		const identityId = this.identitiesByTelegram.get(telegramIdentityId);
		if (!identityId) {
			return null;
		}
		return this.identitiesById.get(identityId) ?? null;
	}

	async listByCursor(): Promise<{ items: IdentityEntity[]; nextCursor?: string }> {
		return {
			items: [...this.identitiesById.values()],
			nextCursor: undefined,
		};
	}

	async countByUsernamePrefix(): Promise<number> {
		return this.identitiesById.size;
	}

	async save(identity: IdentityEntity): Promise<void> {
		this.identitiesById.set(identity.id, identity);
		this.identitiesByTelegram.set(identity.telegramIdentityId, identity.id);
	}

	async delete(id: ReturnType<typeof toIdentityId>): Promise<void> {
		const identity = this.identitiesById.get(id);
		if (!identity) {
			return;
		}
		this.identitiesById.delete(id);
		this.identitiesByTelegram.delete(identity.telegramIdentityId);
	}

	async listByIds(ids: readonly ReturnType<typeof toIdentityId>[]): Promise<IdentityEntity[]> {
		return ids.map((id) => this.identitiesById.get(id)).filter((item): item is IdentityEntity => Boolean(item));
	}
}

class InMemoryCache implements CachePort {
	private readonly storage = new Map<string, unknown>();

	async get<T>(key: string): Promise<T | null> {
		return (this.storage.get(key) as T | undefined) ?? null;
	}

	async set<T>(key: string, value: T, _ttlSeconds: number): Promise<void> {
		this.storage.set(key, value);
	}

	async del(key: string): Promise<void> {
		this.storage.delete(key);
	}

	async wrap<T>(key: string, _ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
		const existing = await this.get<T>(key);
		if (existing !== null) {
			return existing;
		}
		const value = await factory();
		await this.set(key, value, 60);
		return value;
	}
}

class AllowAllRateLimiter implements RateLimiterPort {
	async consume(): Promise<{ allowed: boolean; remaining: number; resetAtEpochSeconds: number }> {
		return { allowed: true, remaining: 1, resetAtEpochSeconds: Math.floor(Date.now() / 1000) + 1 };
	}
}

test("GetIdentityProfileQueryHandler returns profile from repositories and caches result", async () => {
	const identityRepository = new InMemoryIdentityRepository();
	const cache = new InMemoryCache();
	const rateLimiter = new AllowAllRateLimiter();

	const identity = IdentityEntity.createNew({
		id: toIdentityId("u-1"),
		telegramIdentityId: toTelegramIdentityId(111),
		now: toIsoDateString("2026-01-01T00:00:00.000Z"),
		identity: { username: "alice" },
	});
	await identityRepository.save(identity);

	const handler = new GetIdentityProfileQueryHandler(identityRepository, cache, rateLimiter);
	const profile = await handler.execute(new GetIdentityProfileQuery(111));

	assert.ok(profile);
	assert.equal(profile.identityId, "u-1");
	assert.equal(profile.telegramIdentityId, 111);

	const cached = await handler.execute(new GetIdentityProfileQuery(111));
	assert.deepEqual(cached, profile);
});

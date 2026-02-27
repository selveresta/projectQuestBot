import test from "node:test";
import assert from "node:assert/strict";

import {
	GetUserProfileQuery,
	GetUserProfileQueryHandler,
} from "../../src/modules/system/identity/application/queries/get-user-profile.query";
import type { UserRepositoryPort } from "../../src/modules/system/identity/application/ports/user-repository.port";
import { UserEntity } from "../../src/modules/system/identity/domain/entities/user.entity";
import { toTelegramUserId } from "../../src/modules/system/identity/domain/value-objects/telegram-user-id";
import { toUserId } from "../../src/modules/system/identity/domain/value-objects/user-id";
import type { QuestRepositoryPort } from "../../src/modules/system/quests/application/ports/quest-repository.port";
import { UserQuestProgress } from "../../src/modules/system/quests/domain/entities/user-quest-progress.entity";
import { toQuestId } from "../../src/modules/system/quests/domain/value-objects/quest-id";
import type { CachePort } from "../../src/shared/application/ports/cache.port";
import type { RateLimiterPort } from "../../src/shared/application/ports/rate-limiter.port";
import { toIsoDateString } from "../../src/shared/domain/iso-date";

class InMemoryUserRepository implements UserRepositoryPort {
	private readonly usersById = new Map<string, UserEntity>();
	private readonly usersByTelegram = new Map<number, string>();

	async getById(id: ReturnType<typeof toUserId>): Promise<UserEntity | null> {
		return this.usersById.get(id) ?? null;
	}

	async findByTelegramId(telegramUserId: ReturnType<typeof toTelegramUserId>): Promise<UserEntity | null> {
		const userId = this.usersByTelegram.get(telegramUserId);
		if (!userId) {
			return null;
		}
		return this.usersById.get(userId) ?? null;
	}

	async save(user: UserEntity): Promise<void> {
		this.usersById.set(user.id, user);
		this.usersByTelegram.set(user.telegramUserId, user.id);
	}

	async delete(id: ReturnType<typeof toUserId>): Promise<void> {
		const user = this.usersById.get(id);
		if (!user) {
			return;
		}
		this.usersById.delete(id);
		this.usersByTelegram.delete(user.telegramUserId);
	}

	async listByIds(ids: readonly ReturnType<typeof toUserId>[]): Promise<UserEntity[]> {
		return ids.map((id) => this.usersById.get(id)).filter((item): item is UserEntity => Boolean(item));
	}
}

class InMemoryQuestRepository implements QuestRepositoryPort {
	private readonly progress = new Map<string, UserQuestProgress[]>();

	async getById(): Promise<null> {
		return null;
	}

	async save(): Promise<void> {
		// not needed
	}

	async listActive() {
		return [];
	}

	async assignToUser(): Promise<void> {
		// not needed
	}

	async markCompleted(): Promise<void> {
		// not needed
	}

	async listByUser(
		userId: ReturnType<typeof toUserId>,
	): Promise<{ items: UserQuestProgress[]; nextCursor?: string }> {
		return { items: this.progress.get(userId) ?? [] };
	}

	seed(userId: ReturnType<typeof toUserId>, items: UserQuestProgress[]): void {
		this.progress.set(userId, items);
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

test("GetUserProfileQueryHandler returns profile from repositories and caches result", async () => {
	const userRepository = new InMemoryUserRepository();
	const questRepository = new InMemoryQuestRepository();
	const cache = new InMemoryCache();
	const rateLimiter = new AllowAllRateLimiter();

	const user = UserEntity.createNew({
		id: toUserId("u-1"),
		telegramUserId: toTelegramUserId(111),
		now: toIsoDateString("2026-01-01T00:00:00.000Z"),
		identity: { username: "alice" },
	});
	await userRepository.save(user);
	questRepository.seed(user.id, [
		UserQuestProgress.rehydrate({
			userId: user.id,
			questId: toQuestId("q-1"),
			status: "assigned",
			assignedAt: toIsoDateString("2026-01-01T00:00:00.000Z"),
		}),
		UserQuestProgress.rehydrate({
			userId: user.id,
			questId: toQuestId("q-2"),
			status: "completed",
			assignedAt: toIsoDateString("2026-01-01T00:00:00.000Z"),
			completedAt: toIsoDateString("2026-01-02T00:00:00.000Z"),
		}),
	]);

	const handler = new GetUserProfileQueryHandler(userRepository, questRepository, cache, rateLimiter);
	const profile = await handler.execute(new GetUserProfileQuery(111));

	assert.ok(profile);
	assert.equal(profile.userId, "u-1");
	assert.equal(profile.questsAssigned, 2);
	assert.equal(profile.questsCompleted, 1);

	const cached = await handler.execute(new GetUserProfileQuery(111));
	assert.deepEqual(cached, profile);
});

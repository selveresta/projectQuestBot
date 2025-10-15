import type { RedisClient } from "../infra/redis";
import type { CaptchaChallenge } from "../types/captcha";
import type { QuestId } from "../types/quest";
import type { QuestProgress, QuestProgressEntry, UserRecord } from "../types/user";

function now(): string {
	return new Date().toISOString();
}

export class UserRepository {
	constructor(private readonly redis: RedisClient, private readonly questIds: QuestId[]) {}

	private createDefaultQuestProgress(): QuestProgress {
		return this.questIds.reduce((accumulator, questId) => {
			accumulator[questId] = { completed: false };
			return accumulator;
		}, {} as QuestProgress);
	}

	private createUserRecord(userId: number): UserRecord {
		const timestamp = now();
		return {
			userId,
			captchaPassed: false,
			captchaAttempts: 0,
			quests: this.createDefaultQuestProgress(),
			createdAt: timestamp,
			updatedAt: timestamp,
		};
	}

	private ensureQuestCoverage(user: UserRecord): UserRecord {
		let changed = false;
		const quests: QuestProgress = { ...(user.quests ?? {}) };
		for (const questId of this.questIds) {
			if (!quests[questId]) {
				quests[questId] = { completed: false };
				changed = true;
			}
		}
		if (!changed) {
			return user;
		}
		const updated: UserRecord = {
			...user,
			quests,
			updatedAt: now(),
		};
		return updated;
	}

	private key(userId: number): string {
		return `user:${userId}`;
	}

	async get(userId: number): Promise<UserRecord | null> {
		const payload = await this.redis.get(this.key(userId));
		if (!payload) {
			return null;
		}

		try {
			const user: UserRecord = JSON.parse(payload);
			const normalized = this.ensureQuestCoverage(user);
			if (normalized !== user) {
				await this.save(normalized);
			}
			return normalized;
		} catch (error) {
			console.error("[userRepository] failed to parse user", { userId, error });
			return null;
		}
	}

	async getOrCreate(
		userId: number,
		attributes: Partial<Pick<UserRecord, "username" | "firstName" | "lastName">> = {}
	): Promise<UserRecord> {
		const existing = await this.get(userId);
		if (existing) {
			const updated: UserRecord = {
				...existing,
				...attributes,
				updatedAt: now(),
			};
			await this.save(updated);
			return updated;
		}

		const created = {
			...this.createUserRecord(userId),
			...attributes,
		};
		await this.save(created);
		return created;
	}

	async save(user: UserRecord): Promise<void> {
		const payload = JSON.stringify({ ...user, updatedAt: now() });
		await this.redis.set(this.key(user.userId), payload);
	}

	async setCaptchaChallenge(userId: number, challenge: CaptchaChallenge): Promise<UserRecord> {
		const user = (await this.get(userId)) ?? this.createUserRecord(userId);
		user.pendingCaptcha = challenge;
		user.captchaPassed = false;
		user.updatedAt = now();
		await this.save(user);
		return user;
	}

	async clearCaptcha(userId: number): Promise<UserRecord | null> {
		const user = await this.get(userId);
		if (!user) {
			return null;
		}

		user.pendingCaptcha = null;
		user.updatedAt = now();
		await this.save(user);
		return user;
	}

	async incrementCaptchaAttempts(userId: number): Promise<UserRecord> {
		const user = (await this.get(userId)) ?? this.createUserRecord(userId);
		user.captchaAttempts += 1;
		user.updatedAt = now();
		await this.save(user);
		return user;
	}

	async markCaptchaPassed(userId: number): Promise<UserRecord> {
		const user = (await this.get(userId)) ?? this.createUserRecord(userId);
		user.captchaPassed = true;
		user.pendingCaptcha = null;
		user.updatedAt = now();
		await this.save(user);
		return user;
	}

	async completeQuest(userId: number, questId: QuestId, metadata?: string): Promise<UserRecord> {
		const user = (await this.get(userId)) ?? this.createUserRecord(userId);
		const questProgress: QuestProgressEntry = user.quests[questId] ?? ({ completed: false } as QuestProgressEntry);

		questProgress.completed = true;
		questProgress.completedAt = now();
		if (metadata) {
			questProgress.metadata = metadata;
		}
		user.quests[questId] = questProgress;
		user.updatedAt = now();

		await this.save(user);
		return user;
	}

	async setQuestMetadata(userId: number, questId: QuestId, metadata: string): Promise<UserRecord> {
		const user = (await this.get(userId)) ?? this.createUserRecord(userId);
		const questProgress: QuestProgressEntry = user.quests[questId] ?? ({ completed: false } as QuestProgressEntry);
		questProgress.metadata = metadata;
		user.quests[questId] = questProgress;
		user.updatedAt = now();
		await this.save(user);
		return user;
	}

	async updateContact(
		userId: number,
		contact: Partial<Pick<UserRecord, "email" | "wallet" | "xProfileUrl" | "instagramProfileUrl" | "discordUserId">>
	): Promise<UserRecord> {
		const user = (await this.get(userId)) ?? this.createUserRecord(userId);
		const updated: UserRecord = {
			...user,
			...contact,
			updatedAt: now(),
		};
		await this.save(updated);
		return updated;
	}

	async listAllUsers(): Promise<UserRecord[]> {
		const result: UserRecord[] = [];

		// 1) Collect all user:* keys (scanIterator may yield a string or an array)
		const keys: string[] = [];
		for await (const item of this.redis.scanIterator({ MATCH: "user:*", COUNT: 500 })) {
			if (Array.isArray(item)) {
				for (const k of item) if (k) keys.push(String(k));
			} else if (item) {
				keys.push(String(item));
			}
		}
		if (keys.length === 0) return result;

		// 2) Bulk fetch values. ioredis.mget(...) -> (string | null)[]
		const values = (await this.redis.mGet(keys)) as (string | null)[];

		// 3) Parse JSON and normalize quest coverage
		for (let i = 0; i < values.length; i += 1) {
			const payload = values[i];
			if (!payload) continue;
			try {
				const user = JSON.parse(payload) as UserRecord;
				const normalized = this.ensureQuestCoverage(user);
				result.push(normalized);
			} catch (error) {
				console.error("[userRepository] failed to parse user", { key: keys[i], error });
			}
		}

		return result;
	}

	async countEligibleUsers(requiredQuestIds: QuestId[]): Promise<number> {
		let count = 0;
		for await (const rawKey of this.redis.scanIterator({
			MATCH: "user:*",
		})) {
			const key = String(rawKey);
			if (!key) {
				continue;
			}

			const payload = await this.redis.get(key);
			if (!payload) {
				continue;
			}
			try {
				const user = JSON.parse(payload) as UserRecord;
				const eligible = requiredQuestIds.every((questId) => user.quests[questId]?.completed === true);
				if (eligible && user.captchaPassed) {
					count += 1;
				}
			} catch (error) {
				console.error("[userRepository] eligibility check parse error", {
					key: rawKey,
					error,
				});
			}
		}

		return count;
	}

	async resetProgress(userId: number) {}
}

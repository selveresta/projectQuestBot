import type { RedisClient } from "../infra/redis";
import type { CaptchaChallenge } from "../types/captcha";
import type { QuestId } from "../types/quest";
import { QUEST_ID_LIST } from "../types/quest";
import type { QuestProgress, QuestProgressEntry, UserRecord } from "../types/user";

function now(): string {
	return new Date().toISOString();
}

function buildDefaultQuestProgress(): QuestProgress {
	return QUEST_ID_LIST.reduce((accumulator, questId) => {
		accumulator[questId] = { completed: false };
		return accumulator;
	}, {} as QuestProgress);
}

function createUserRecord(userId: number): UserRecord {
	const timestamp = now();
	return {
		userId,
		captchaPassed: false,
		captchaAttempts: 0,
		quests: buildDefaultQuestProgress(),
		createdAt: timestamp,
		updatedAt: timestamp,
	};
}

export class UserRepository {
	constructor(private readonly redis: RedisClient) {}

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
			return user;
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
			...createUserRecord(userId),
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
		const user = (await this.get(userId)) ?? createUserRecord(userId);
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
		const user = (await this.get(userId)) ?? createUserRecord(userId);
		user.captchaAttempts += 1;
		user.updatedAt = now();
		await this.save(user);
		return user;
	}

	async markCaptchaPassed(userId: number): Promise<UserRecord> {
		const user = (await this.get(userId)) ?? createUserRecord(userId);
		user.captchaPassed = true;
		user.pendingCaptcha = null;
		user.updatedAt = now();
		await this.save(user);
		return user;
	}

	async completeQuest(userId: number, questId: QuestId, metadata?: string): Promise<UserRecord> {
		const user = (await this.get(userId)) ?? createUserRecord(userId);
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

	async updateContact(userId: number, contact: Partial<Pick<UserRecord, "email" | "wallet">>): Promise<UserRecord> {
		const user = (await this.get(userId)) ?? createUserRecord(userId);
		const updated: UserRecord = {
			...user,
			...contact,
			updatedAt: now(),
		};
		await this.save(updated);
		return updated;
	}

	async listAllUsers(): Promise<UserRecord[]> {
		const users: UserRecord[] = [];
		for await (const rawKey of this.redis.scanIterator({
			MATCH: "user:*",
			COUNT: 100,
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
				users.push(user);
			} catch (error) {
				console.error("[userRepository] failed to parse user during scan", {
					key: rawKey,
					error,
				});
			}
		}
		return users;
	}

	async countEligibleUsers(requiredQuestIds: QuestId[]): Promise<number> {
		let count = 0;
		for await (const rawKey of this.redis.scanIterator({
			MATCH: "user:*",
			COUNT: 200,
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
}

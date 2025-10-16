import type { RedisClient } from "../infra/redis";
import type { CaptchaChallenge } from "../types/captcha";
import type { QuestId } from "../types/quest";
import type { QuestProgress, QuestProgressEntry, UserRecord } from "../types/user";

function now(): string {
	return new Date().toISOString();
}

export class UserRepository {
	constructor(private readonly redis: RedisClient, private readonly questIds: QuestId[]) {}

	private compareByPoints(a: UserRecord, b: UserRecord): number {
		const diff = (b.points ?? 0) - (a.points ?? 0);
		if (diff !== 0) {
			return diff;
		}
		return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
	}

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
			points: 0,
			questPoints: {},
			creditedReferrals: [],
			referralBonusClaimed: false,
			createdAt: timestamp,
			updatedAt: timestamp,
		};
	}

	private normalizeUser(user: UserRecord): UserRecord {
		let changed = false;

		let quests = user.quests;
		if (!quests) {
			quests = this.createDefaultQuestProgress();
			changed = true;
		} else {
			const normalizedQuests: QuestProgress = { ...quests };
			let questChanged = false;
			for (const questId of this.questIds) {
				if (!normalizedQuests[questId]) {
					normalizedQuests[questId] = { completed: false };
					questChanged = true;
				}
			}
			if (questChanged) {
				quests = normalizedQuests;
				changed = true;
			}
		}

		const points = typeof user.points === "number" ? user.points : 0;
		if (points !== user.points) {
			changed = true;
		}

		const questPoints: Partial<Record<QuestId, number>> = user.questPoints ? { ...user.questPoints } : {};
		if (!user.questPoints) {
			changed = true;
		}

		const creditedReferrals = Array.isArray(user.creditedReferrals) ? [...user.creditedReferrals] : [];
		if (!Array.isArray(user.creditedReferrals)) {
			changed = true;
		}

		const referralBonusClaimed = typeof user.referralBonusClaimed === "boolean" ? user.referralBonusClaimed : false;
		if (referralBonusClaimed !== user.referralBonusClaimed) {
			changed = true;
		}

		if (!changed) {
			return user;
		}

		const normalized: UserRecord = {
			...user,
			quests,
			questPoints,
			points,
			creditedReferrals,
			referralBonusClaimed,
			updatedAt: now(),
		};

		return normalized;
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
			const normalized = this.normalizeUser(user);
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
		attributes: Partial<Pick<UserRecord, "username" | "firstName" | "lastName" | "referredBy">> = {}
	): Promise<UserRecord> {
		const existing = await this.get(userId);
		if (existing) {
			const referredBy = existing.referredBy ?? attributes.referredBy;
			const updated: UserRecord = {
				...existing,
				...attributes,
				referredBy,
				updatedAt: now(),
			};
			await this.save(updated);
			return updated;
		}

		const created: UserRecord = {
			...this.createUserRecord(userId),
			...attributes,
		};
		if (attributes.referredBy) {
			created.referredBy = attributes.referredBy;
		}
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

	async assignReferrer(userId: number, referrerId: number): Promise<UserRecord> {
		const user = (await this.get(userId)) ?? this.createUserRecord(userId);
		if (!user.referredBy && userId !== referrerId) {
			user.referredBy = referrerId;
			user.updatedAt = now();
			await this.save(user);
		}
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

	async addQuestPoints(userId: number, questId: QuestId, points: number): Promise<UserRecord> {
		if (points <= 0) {
			return (await this.get(userId)) ?? this.createUserRecord(userId);
		}

		const user = (await this.get(userId)) ?? this.createUserRecord(userId);
		const questPoints = user.questPoints ?? {};
		const alreadyAwarded = questPoints[questId] ?? 0;
		if (alreadyAwarded >= points) {
			return user;
		}

		const delta = points - alreadyAwarded;
		questPoints[questId] = points;
		user.questPoints = questPoints;
		user.points = (user.points ?? 0) + delta;
		user.updatedAt = now();
		await this.save(user);
		return user;
	}

	async awardReferralBonus(referrerId: number, referredUserId: number, points: number): Promise<UserRecord | null> {
		if (points <= 0) {
			return this.get(referrerId);
		}

		const referrer = await this.get(referrerId);
		if (!referrer) {
			return null;
		}

		const creditedReferrals = referrer.creditedReferrals ?? [];
		if (creditedReferrals.includes(referredUserId)) {
			return referrer;
		}

		referrer.creditedReferrals = [...creditedReferrals, referredUserId];
		referrer.points = (referrer.points ?? 0) + points;
		referrer.updatedAt = now();
		await this.save(referrer);
		return referrer;
	}

	async markReferralBonusClaimed(userId: number): Promise<UserRecord> {
		const user = (await this.get(userId)) ?? this.createUserRecord(userId);
		if (!user.referralBonusClaimed) {
			user.referralBonusClaimed = true;
			user.updatedAt = now();
			await this.save(user);
		}
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
                contact: Partial<
                        Pick<
                                UserRecord,
                                "email" | "wallet" | "solanaWallet" | "xProfileUrl" | "instagramProfileUrl" | "discordUserId"
                        >
                >
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
				const normalized = this.normalizeUser(user);
				result.push(normalized);
			} catch (error) {
				console.error("[userRepository] failed to parse user", { key: keys[i], error });
			}
		}

		return result;
	}

	async getTopUsersByPoints(limit: number): Promise<UserRecord[]> {
		const users = await this.listAllUsers();
		const sorted = [...users].sort((a, b) => this.compareByPoints(a, b));
		if (limit <= 0) {
			return sorted;
		}
		return sorted.slice(0, limit);
	}

	async getUserRank(userId: number): Promise<{ rank: number; points: number; total: number } | null> {
		const users = await this.listAllUsers();
		if (users.length === 0) {
			return null;
		}

		const sorted = [...users].sort((a, b) => this.compareByPoints(a, b));
		let previousPoints: number | null = null;
		let rank = 0;

		for (let index = 0; index < sorted.length; index += 1) {
			const points = sorted[index].points ?? 0;
			if (previousPoints === null || points < previousPoints) {
				rank = index + 1;
				previousPoints = points;
			}
			if (sorted[index].userId === userId) {
				return { rank, points, total: sorted.length };
			}
		}

		return null;
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

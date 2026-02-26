import { Inject, Injectable } from "@nestjs/common";

import { PinoLoggerService } from "../../../common/logger/pino-logger.service";
import type { UserEntity, UserIdentity } from "../domain/user.entity";
import { REDIS_CLIENT } from "../telegram.constants";
import type { UserRepositoryPort } from "../application/ports/user-repository.port";
import type { RedisClient } from "./redis.provider";

@Injectable()
export class RedisUserRepository implements UserRepositoryPort {
	constructor(
		@Inject(REDIS_CLIENT) private readonly redis: RedisClient,
		private readonly logger: PinoLoggerService
	) {}

	async get(userId: number): Promise<UserEntity | null> {
		const payload = await this.redis.get(this.key(userId));
		if (!payload) {
			return null;
		}

		try {
			const parsed = JSON.parse(payload) as Partial<UserEntity> & { userId?: unknown };
			if (!Number.isSafeInteger(parsed.userId)) {
				return null;
			}
			return this.normalize({ ...parsed, userId: parsed.userId as number });
		} catch (error) {
			this.logger.error("Failed to parse user from Redis", { userId, error });
			return null;
		}
	}

	async getOrCreate(userId: number, identity: UserIdentity): Promise<UserEntity> {
		const existing = await this.get(userId);
		if (!existing) {
			const created = this.createUserRecord(userId, identity);
			await this.save(created);
			return created;
		}

		const merged = this.mergeIdentity(existing, identity);
		await this.save(merged);
		return merged;
	}

	async setReferrerIfEmpty(userId: number, referrerId: number): Promise<UserEntity> {
		const user = await this.getOrCreate(userId, {});
		if (!user.referredBy && user.userId !== referrerId) {
			const updated: UserEntity = {
				...user,
				referredBy: referrerId,
				updatedAt: this.now(),
			};
			await this.save(updated);
			return updated;
		}

		return user;
	}

	async markReferralBonusClaimed(userId: number): Promise<UserEntity> {
		const user = await this.getOrCreate(userId, {});
		if (user.referralBonusClaimed) {
			return user;
		}

		const updated: UserEntity = {
			...user,
			referralBonusClaimed: true,
			updatedAt: this.now(),
		};
		await this.save(updated);
		return updated;
	}

	async awardReferralBonus(referrerId: number, referredUserId: number, points: number): Promise<UserEntity | null> {
		if (points <= 0) {
			return this.get(referrerId);
		}

		const referrer = await this.get(referrerId);
		if (!referrer) {
			return null;
		}

		if (referrer.creditedReferrals.includes(referredUserId)) {
			return referrer;
		}

		const updated: UserEntity = {
			...referrer,
			creditedReferrals: [...referrer.creditedReferrals, referredUserId],
			points: referrer.points + points,
			updatedAt: this.now(),
		};
		await this.save(updated);
		return updated;
	}

	async listAll(): Promise<UserEntity[]> {
		const keys: string[] = [];
		for await (const item of this.redis.scanIterator({ MATCH: "users:*", COUNT: 500 })) {
			if (Array.isArray(item)) {
				for (const entry of item) {
					if (entry) {
						keys.push(String(entry));
					}
				}
			} else if (item) {
				keys.push(String(item));
			}
		}

		if (keys.length === 0) {
			return [];
		}

		const values = await this.redis.mGet(keys);
		const users: UserEntity[] = [];

		for (const value of values) {
			if (!value) {
				continue;
			}
			try {
				const parsed = JSON.parse(value) as Partial<UserEntity> & { userId?: unknown };
				if (Number.isSafeInteger(parsed.userId)) {
					users.push(this.normalize({ ...parsed, userId: parsed.userId as number }));
				}
			} catch (error) {
				this.logger.error("Failed to parse user during listAll", { error });
			}
		}

		return users;
	}

	private async save(user: UserEntity): Promise<void> {
		const normalized = this.normalize(user);
		await this.redis.set(this.key(normalized.userId), JSON.stringify(normalized));
	}

	private createUserRecord(userId: number, identity: UserIdentity): UserEntity {
		const timestamp = this.now();
		return {
			userId,
			username: identity.username,
			firstName: identity.firstName,
			lastName: identity.lastName,
			points: 0,
			referralBonusClaimed: false,
			creditedReferrals: [],
			createdAt: timestamp,
			updatedAt: timestamp,
		};
	}

	private mergeIdentity(user: UserEntity, identity: UserIdentity): UserEntity {
		return {
			...user,
			username: identity.username ?? user.username,
			firstName: identity.firstName ?? user.firstName,
			lastName: identity.lastName ?? user.lastName,
			updatedAt: this.now(),
		};
	}

	private normalize(candidate: Partial<UserEntity> & { userId: number }): UserEntity {
		const now = this.now();
		const rawPoints = typeof candidate.points === "number" ? candidate.points : 0;
		const points = Number.isFinite(rawPoints) ? Math.max(0, Math.floor(rawPoints)) : 0;
		const creditedReferrals = Array.isArray(candidate.creditedReferrals)
			? candidate.creditedReferrals.filter((value): value is number => Number.isSafeInteger(value))
			: [];

		return {
			userId: candidate.userId,
			username: typeof candidate.username === "string" ? candidate.username : undefined,
			firstName: typeof candidate.firstName === "string" ? candidate.firstName : undefined,
			lastName: typeof candidate.lastName === "string" ? candidate.lastName : undefined,
			points,
			referredBy: Number.isSafeInteger(candidate.referredBy) ? candidate.referredBy : undefined,
			referralBonusClaimed: candidate.referralBonusClaimed === true,
			creditedReferrals,
			createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : now,
			updatedAt: this.now(),
		};
	}

	private key(userId: number): string {
		return `users:${userId}`;
	}

	private now(): string {
		return new Date().toISOString();
	}
}

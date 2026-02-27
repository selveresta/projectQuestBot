import type { IsoDateString } from "../../../../../shared/domain/iso-date";
import { toIsoDateString } from "../../../../../shared/domain/iso-date";
import type { TelegramUserId } from "../value-objects/telegram-user-id";
import type { UserId } from "../value-objects/user-id";

export interface UserIdentitySnapshot {
	username?: string;
	firstName?: string;
	lastName?: string;
}

export interface UserEntitySnapshot extends UserIdentitySnapshot {
	id: UserId;
	telegramUserId: TelegramUserId;
	points: number;
	referredBy?: UserId;
	referralBonusClaimed: boolean;
	creditedReferralIds: UserId[];
	createdAt: IsoDateString;
	updatedAt: IsoDateString;
}

export class UserEntity {
	private constructor(private readonly snapshot: UserEntitySnapshot) {}

	static createNew(params: {
		id: UserId;
		telegramUserId: TelegramUserId;
		now: IsoDateString;
		identity: UserIdentitySnapshot;
	}): UserEntity {
		return UserEntity.rehydrate({
			id: params.id,
			telegramUserId: params.telegramUserId,
			username: params.identity.username,
			firstName: params.identity.firstName,
			lastName: params.identity.lastName,
			points: 0,
			referralBonusClaimed: false,
			creditedReferralIds: [],
			createdAt: params.now,
			updatedAt: params.now,
		});
	}

	static rehydrate(snapshot: UserEntitySnapshot): UserEntity {
		if (snapshot.points < 0 || !Number.isFinite(snapshot.points)) {
			throw new Error("User points must be a non-negative number");
		}

		const uniqueCredits = Array.from(new Set(snapshot.creditedReferralIds));
		if (uniqueCredits.length !== snapshot.creditedReferralIds.length) {
			snapshot = {
				...snapshot,
				creditedReferralIds: uniqueCredits,
			};
		}

		return new UserEntity({
			...snapshot,
			createdAt: toIsoDateString(snapshot.createdAt),
			updatedAt: toIsoDateString(snapshot.updatedAt),
		});
	}

	get id(): UserId {
		return this.snapshot.id;
	}

	get telegramUserId(): TelegramUserId {
		return this.snapshot.telegramUserId;
	}

	get points(): number {
		return this.snapshot.points;
	}

	get referredBy(): UserId | undefined {
		return this.snapshot.referredBy;
	}

	get referralBonusClaimed(): boolean {
		return this.snapshot.referralBonusClaimed;
	}

	get creditedReferralIds(): readonly UserId[] {
		return this.snapshot.creditedReferralIds;
	}

	toSnapshot(): UserEntitySnapshot {
		return {
			...this.snapshot,
			creditedReferralIds: [...this.snapshot.creditedReferralIds],
		};
	}

	withIdentity(identity: UserIdentitySnapshot, now: IsoDateString): UserEntity {
		return UserEntity.rehydrate({
			...this.snapshot,
			username: identity.username ?? this.snapshot.username,
			firstName: identity.firstName ?? this.snapshot.firstName,
			lastName: identity.lastName ?? this.snapshot.lastName,
			updatedAt: now,
		});
	}

	assignReferrer(referrerId: UserId, now: IsoDateString): UserEntity {
		if (referrerId === this.id) {
			throw new Error("User cannot refer itself");
		}
		if (this.snapshot.referredBy) {
			return this;
		}

		return UserEntity.rehydrate({
			...this.snapshot,
			referredBy: referrerId,
			updatedAt: now,
		});
	}

	claimReferralBonus(now: IsoDateString): UserEntity {
		if (this.snapshot.referralBonusClaimed) {
			return this;
		}

		return UserEntity.rehydrate({
			...this.snapshot,
			referralBonusClaimed: true,
			updatedAt: now,
		});
	}

	creditReferral(referredUserId: UserId, pointsDelta: number, now: IsoDateString): UserEntity {
		if (pointsDelta <= 0 || !Number.isFinite(pointsDelta)) {
			throw new Error("pointsDelta must be a positive number");
		}
		if (referredUserId === this.id) {
			throw new Error("Cannot credit referral for same user");
		}
		if (this.snapshot.creditedReferralIds.includes(referredUserId)) {
			return this;
		}

		return UserEntity.rehydrate({
			...this.snapshot,
			points: this.snapshot.points + pointsDelta,
			creditedReferralIds: [...this.snapshot.creditedReferralIds, referredUserId],
			updatedAt: now,
		});
	}

	applyPointsDelta(delta: number, now: IsoDateString): UserEntity {
		const nextPoints = this.snapshot.points + delta;
		if (nextPoints < 0) {
			throw new Error("User points cannot be negative");
		}
		return UserEntity.rehydrate({
			...this.snapshot,
			points: nextPoints,
			updatedAt: now,
		});
	}
}

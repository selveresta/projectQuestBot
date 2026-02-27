import type { IsoDateString } from "../../../../../shared/domain/iso-date";
import { toIsoDateString } from "../../../../../shared/domain/iso-date";
import type { TelegramIdentityId } from "../value-objects/telegram-identity-id";
import type { IdentityId } from "../value-objects/identity-id";

export interface IdentitySnapshot {
	username?: string;
	firstName?: string;
	lastName?: string;
}

export interface IdentityEntitySnapshot extends IdentitySnapshot {
	id: IdentityId;
	telegramIdentityId: TelegramIdentityId;
	points: number;
	referredBy?: IdentityId;
	referralBonusClaimed: boolean;
	creditedReferralIds: IdentityId[];
	createdAt: IsoDateString;
	updatedAt: IsoDateString;
}

export class IdentityEntity {
	private constructor(private readonly snapshot: IdentityEntitySnapshot) {}

	static createNew(params: {
		id: IdentityId;
		telegramIdentityId: TelegramIdentityId;
		now: IsoDateString;
		identity: IdentitySnapshot;
	}): IdentityEntity {
		return IdentityEntity.rehydrate({
			id: params.id,
			telegramIdentityId: params.telegramIdentityId,
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

	static rehydrate(snapshot: IdentityEntitySnapshot): IdentityEntity {
		if (snapshot.points < 0 || !Number.isFinite(snapshot.points)) {
			throw new Error("Identity points must be a non-negative number");
		}

		const uniqueCredits = Array.from(new Set(snapshot.creditedReferralIds));
		if (uniqueCredits.length !== snapshot.creditedReferralIds.length) {
			snapshot = {
				...snapshot,
				creditedReferralIds: uniqueCredits,
			};
		}

		return new IdentityEntity({
			...snapshot,
			createdAt: toIsoDateString(snapshot.createdAt),
			updatedAt: toIsoDateString(snapshot.updatedAt),
		});
	}

	get id(): IdentityId {
		return this.snapshot.id;
	}

	get telegramIdentityId(): TelegramIdentityId {
		return this.snapshot.telegramIdentityId;
	}

	get points(): number {
		return this.snapshot.points;
	}

	get referredBy(): IdentityId | undefined {
		return this.snapshot.referredBy;
	}

	get referralBonusClaimed(): boolean {
		return this.snapshot.referralBonusClaimed;
	}

	get creditedReferralIds(): readonly IdentityId[] {
		return this.snapshot.creditedReferralIds;
	}

	toSnapshot(): IdentityEntitySnapshot {
		return {
			...this.snapshot,
			creditedReferralIds: [...this.snapshot.creditedReferralIds],
		};
	}

	withIdentity(identity: IdentitySnapshot, now: IsoDateString): IdentityEntity {
		return IdentityEntity.rehydrate({
			...this.snapshot,
			username: identity.username ?? this.snapshot.username,
			firstName: identity.firstName ?? this.snapshot.firstName,
			lastName: identity.lastName ?? this.snapshot.lastName,
			updatedAt: now,
		});
	}

	assignReferrer(referrerId: IdentityId, now: IsoDateString): IdentityEntity {
		if (referrerId === this.id) {
			throw new Error("Identity cannot refer itself");
		}
		if (this.snapshot.referredBy) {
			return this;
		}

		return IdentityEntity.rehydrate({
			...this.snapshot,
			referredBy: referrerId,
			updatedAt: now,
		});
	}

	claimReferralBonus(now: IsoDateString): IdentityEntity {
		if (this.snapshot.referralBonusClaimed) {
			return this;
		}

		return IdentityEntity.rehydrate({
			...this.snapshot,
			referralBonusClaimed: true,
			updatedAt: now,
		});
	}

	creditReferral(referredIdentityId: IdentityId, pointsDelta: number, now: IsoDateString): IdentityEntity {
		if (pointsDelta <= 0 || !Number.isFinite(pointsDelta)) {
			throw new Error("pointsDelta must be a positive number");
		}
		if (referredIdentityId === this.id) {
			throw new Error("Cannot credit referral for same identity");
		}
		if (this.snapshot.creditedReferralIds.includes(referredIdentityId)) {
			return this;
		}

		return IdentityEntity.rehydrate({
			...this.snapshot,
			points: this.snapshot.points + pointsDelta,
			creditedReferralIds: [...this.snapshot.creditedReferralIds, referredIdentityId],
			updatedAt: now,
		});
	}

	applyPointsDelta(delta: number, now: IsoDateString): IdentityEntity {
		const nextPoints = this.snapshot.points + delta;
		if (nextPoints < 0) {
			throw new Error("Identity points cannot be negative");
		}
		return IdentityEntity.rehydrate({
			...this.snapshot,
			points: nextPoints,
			updatedAt: now,
		});
	}
}

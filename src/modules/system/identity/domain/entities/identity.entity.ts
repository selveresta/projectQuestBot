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
			createdAt: params.now,
			updatedAt: params.now,
		});
	}

	static rehydrate(snapshot: IdentityEntitySnapshot): IdentityEntity {
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

	toSnapshot(): IdentityEntitySnapshot {
		return { ...this.snapshot };
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
}

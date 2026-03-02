import type { IsoDateString } from "../../../../../shared/domain/iso-date";
import { toIsoDateString } from "../../../../../shared/domain/iso-date";
import type { TelegramIdentityId } from "../value-objects/telegram-identity-id";
import type { IdentityId } from "../value-objects/identity-id";

export type IdentityStatus = "active" | "blocked";

export interface IdentitySnapshot {
	username?: string;
	firstName?: string;
	lastName?: string;
}

export interface IdentityEntitySnapshot extends IdentitySnapshot {
	id: IdentityId;
	telegramIdentityId: TelegramIdentityId;
	status: IdentityStatus;
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
		status?: IdentityStatus;
	}): IdentityEntity {
		return IdentityEntity.rehydrate({
			id: params.id,
			telegramIdentityId: params.telegramIdentityId,
			status: params.status ?? "active",
			username: params.identity.username,
			firstName: params.identity.firstName,
			lastName: params.identity.lastName,
			createdAt: params.now,
			updatedAt: params.now,
		});
	}

	static rehydrate(snapshot: Omit<IdentityEntitySnapshot, "status"> & { status?: IdentityStatus }): IdentityEntity {
		return new IdentityEntity({
			...snapshot,
			status: snapshot.status ?? "active",
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

	get status(): IdentityStatus {
		return this.snapshot.status;
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

	withStatus(status: IdentityStatus, now: IsoDateString): IdentityEntity {
		return IdentityEntity.rehydrate({
			...this.snapshot,
			status,
			updatedAt: now,
		});
	}

	isBlocked(): boolean {
		return this.snapshot.status === "blocked";
	}
}

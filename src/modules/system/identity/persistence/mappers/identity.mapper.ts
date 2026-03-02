import { IdentityEntity } from "../../domain/entities/identity.entity";
import { toTelegramIdentityId } from "../../domain/value-objects/telegram-identity-id";
import { toIdentityId } from "../../domain/value-objects/identity-id";
import { toIsoDateString } from "../../../../../shared/domain/iso-date";

export type RedisIdentityHash = Record<string, string> & {
	id: string;
	telegram_identity_id: string;
	status: string;
	username: string;
	first_name: string;
	last_name: string;
	created_at: string;
	updated_at: string;
};

export interface PostgresIdentityRow {
	id: string;
	telegram_id: string;
	status: string;
	username: string | null;
	first_name: string | null;
	last_name: string | null;
	created_at: string;
	updated_at: string;
}

export function identityToRedisHash(identity: IdentityEntity): RedisIdentityHash {
	const snapshot = identity.toSnapshot();
	return {
		id: snapshot.id,
		telegram_identity_id: String(snapshot.telegramIdentityId),
		status: snapshot.status,
		username: snapshot.username ?? "",
		first_name: snapshot.firstName ?? "",
		last_name: snapshot.lastName ?? "",
		created_at: snapshot.createdAt,
		updated_at: snapshot.updatedAt,
	};
}

export function redisHashToIdentity(hash: Record<string, string>): IdentityEntity | null {
	const telegramIdentityRaw = hash.telegram_identity_id;
	if (!hash.id || !telegramIdentityRaw) {
		return null;
	}

	return IdentityEntity.rehydrate({
		id: toIdentityId(hash.id),
		telegramIdentityId: toTelegramIdentityId(Number.parseInt(telegramIdentityRaw, 10)),
		status: hash.status === "blocked" ? "blocked" : "active",
		username: hash.username || undefined,
		firstName: hash.first_name || undefined,
		lastName: hash.last_name || undefined,
		createdAt: toIsoDateString(hash.created_at),
		updatedAt: toIsoDateString(hash.updated_at),
	});
}

export function identityToPostgresRow(identity: IdentityEntity): PostgresIdentityRow {
	const snapshot = identity.toSnapshot();
	return {
		id: snapshot.id,
		telegram_id: String(snapshot.telegramIdentityId),
		status: snapshot.status,
		username: snapshot.username ?? null,
		first_name: snapshot.firstName ?? null,
		last_name: snapshot.lastName ?? null,
		created_at: snapshot.createdAt,
		updated_at: snapshot.updatedAt,
	};
}

export function postgresRowToIdentity(row: PostgresIdentityRow): IdentityEntity {
	return IdentityEntity.rehydrate({
		id: toIdentityId(row.id),
		telegramIdentityId: toTelegramIdentityId(Number.parseInt(row.telegram_id, 10)),
		status: row.status === "blocked" ? "blocked" : "active",
		username: row.username ?? undefined,
		firstName: row.first_name ?? undefined,
		lastName: row.last_name ?? undefined,
		createdAt: toIsoDateString(row.created_at),
		updatedAt: toIsoDateString(row.updated_at),
	});
}

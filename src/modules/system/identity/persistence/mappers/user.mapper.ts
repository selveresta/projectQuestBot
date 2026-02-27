import { UserEntity } from "../../domain/entities/user.entity";
import { toTelegramUserId } from "../../domain/value-objects/telegram-user-id";
import { toUserId } from "../../domain/value-objects/user-id";
import { toIsoDateString } from "../../../../../shared/domain/iso-date";

export type RedisUserHash = Record<string, string> & {
	id: string;
	telegram_user_id: string;
	username: string;
	first_name: string;
	last_name: string;
	points: string;
	referred_by: string;
	referral_bonus_claimed: "0" | "1";
	credited_referrals: string;
	created_at: string;
	updated_at: string;
};

export interface PostgresUserRow {
	id: string;
	telegram_id: string;
	username: string | null;
	first_name: string | null;
	last_name: string | null;
	points: number;
	referred_by: string | null;
	referral_bonus_claimed: boolean;
	created_at: string;
	updated_at: string;
}

export function userToRedisHash(user: UserEntity): RedisUserHash {
	const snapshot = user.toSnapshot();
	return {
		id: snapshot.id,
		telegram_user_id: String(snapshot.telegramUserId),
		username: snapshot.username ?? "",
		first_name: snapshot.firstName ?? "",
		last_name: snapshot.lastName ?? "",
		points: String(snapshot.points),
		referred_by: snapshot.referredBy ?? "",
		referral_bonus_claimed: snapshot.referralBonusClaimed ? "1" : "0",
		credited_referrals: JSON.stringify(snapshot.creditedReferralIds),
		created_at: snapshot.createdAt,
		updated_at: snapshot.updatedAt,
	};
}

export function redisHashToUser(hash: Record<string, string>): UserEntity | null {
	if (!hash.id || !hash.telegram_user_id) {
		return null;
	}

	const credits = parseCredits(hash.credited_referrals);
	return UserEntity.rehydrate({
		id: toUserId(hash.id),
		telegramUserId: toTelegramUserId(Number.parseInt(hash.telegram_user_id, 10)),
		username: hash.username || undefined,
		firstName: hash.first_name || undefined,
		lastName: hash.last_name || undefined,
		points: Number.parseInt(hash.points || "0", 10),
		referredBy: hash.referred_by ? toUserId(hash.referred_by) : undefined,
		referralBonusClaimed: hash.referral_bonus_claimed === "1",
		creditedReferralIds: credits,
		createdAt: toIsoDateString(hash.created_at),
		updatedAt: toIsoDateString(hash.updated_at),
	});
}

export function userToPostgresRow(user: UserEntity): PostgresUserRow {
	const snapshot = user.toSnapshot();
	return {
		id: snapshot.id,
		telegram_id: String(snapshot.telegramUserId),
		username: snapshot.username ?? null,
		first_name: snapshot.firstName ?? null,
		last_name: snapshot.lastName ?? null,
		points: snapshot.points,
		referred_by: snapshot.referredBy ?? null,
		referral_bonus_claimed: snapshot.referralBonusClaimed,
		created_at: snapshot.createdAt,
		updated_at: snapshot.updatedAt,
	};
}

export function postgresRowToUser(row: PostgresUserRow, creditedReferrals: readonly string[]): UserEntity {
	return UserEntity.rehydrate({
		id: toUserId(row.id),
		telegramUserId: toTelegramUserId(Number.parseInt(row.telegram_id, 10)),
		username: row.username ?? undefined,
		firstName: row.first_name ?? undefined,
		lastName: row.last_name ?? undefined,
		points: row.points,
		referredBy: row.referred_by ? toUserId(row.referred_by) : undefined,
		referralBonusClaimed: row.referral_bonus_claimed,
		creditedReferralIds: creditedReferrals.map((value) => toUserId(value)),
		createdAt: toIsoDateString(row.created_at),
		updatedAt: toIsoDateString(row.updated_at),
	});
}

function parseCredits(raw: string | undefined): ReturnType<typeof toUserId>[] {
	if (!raw) {
		return [];
	}
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed
			.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
			.map((item) => toUserId(item));
	} catch {
		return [];
	}
}

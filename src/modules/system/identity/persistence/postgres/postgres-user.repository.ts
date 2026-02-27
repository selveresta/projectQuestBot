import { Inject, Injectable } from "@nestjs/common";

import type { UserRepositoryPort } from "../../application/ports/user-repository.port";
import type { UserEntity } from "../../domain/entities/user.entity";
import type { TelegramUserId } from "../../domain/value-objects/telegram-user-id";
import type { UserId } from "../../domain/value-objects/user-id";
import {
	postgresRowToUser,
	type PostgresUserRow,
	userToPostgresRow,
} from "../mappers/user.mapper";
import { POSTGRES_POOL } from "../../../../../shared/persistence/postgres/postgres.constants";
import type { PostgresPool } from "../../../../../shared/persistence/postgres/postgres.provider";

@Injectable()
export class PostgresUserRepository implements UserRepositoryPort {
	constructor(@Inject(POSTGRES_POOL) private readonly postgresPool: PostgresPool | null) {}

	async getById(id: UserId): Promise<UserEntity | null> {
		const pool = this.requirePool();
		const rowRes = await pool.query<PostgresUserRow>(
			`SELECT id, telegram_id::text, username, first_name, last_name, points, referred_by, referral_bonus_claimed, created_at, updated_at
			 FROM users
			 WHERE id = $1`,
			[id],
		);
		if (rowRes.rowCount === 0) {
			return null;
		}
		const credits = await this.loadCredits(pool, id);
		return postgresRowToUser(rowRes.rows[0], credits);
	}

	async findByTelegramId(telegramUserId: TelegramUserId): Promise<UserEntity | null> {
		const pool = this.requirePool();
		const rowRes = await pool.query<PostgresUserRow>(
			`SELECT id, telegram_id::text, username, first_name, last_name, points, referred_by, referral_bonus_claimed, created_at, updated_at
			 FROM users
			 WHERE telegram_id = $1`,
			[String(telegramUserId)],
		);
		if (rowRes.rowCount === 0) {
			return null;
		}
		const credits = await this.loadCredits(pool, rowRes.rows[0].id as UserId);
		return postgresRowToUser(rowRes.rows[0], credits);
	}

	async save(user: UserEntity): Promise<void> {
		const pool = this.requirePool();
		const row = userToPostgresRow(user);
		await pool.query(
			`INSERT INTO users (id, telegram_id, username, first_name, last_name, points, referred_by, referral_bonus_claimed, created_at, updated_at)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
			 ON CONFLICT (id)
			 DO UPDATE SET telegram_id = EXCLUDED.telegram_id,
				username = EXCLUDED.username,
				first_name = EXCLUDED.first_name,
				last_name = EXCLUDED.last_name,
				points = EXCLUDED.points,
				referred_by = EXCLUDED.referred_by,
				referral_bonus_claimed = EXCLUDED.referral_bonus_claimed,
				updated_at = EXCLUDED.updated_at`,
			[
				row.id,
				row.telegram_id,
				row.username,
				row.first_name,
				row.last_name,
				row.points,
				row.referred_by,
				row.referral_bonus_claimed,
				row.created_at,
				row.updated_at,
			],
		);

		await pool.query("DELETE FROM user_referral_credits WHERE referrer_id = $1", [row.id]);
		for (const referredUserId of user.creditedReferralIds) {
			await pool.query(
				"INSERT INTO user_referral_credits (referrer_id, referred_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
				[row.id, referredUserId],
			);
		}
	}

	async delete(id: UserId): Promise<void> {
		const pool = this.requirePool();
		await pool.query("DELETE FROM user_referral_credits WHERE referrer_id = $1", [id]);
		await pool.query("DELETE FROM users WHERE id = $1", [id]);
	}

	async listByIds(ids: readonly UserId[]): Promise<UserEntity[]> {
		if (ids.length === 0) {
			return [];
		}
		const pool = this.requirePool();
		const rowsRes = await pool.query<PostgresUserRow>(
			`SELECT id, telegram_id::text, username, first_name, last_name, points, referred_by, referral_bonus_claimed, created_at, updated_at
			 FROM users
			 WHERE id = ANY($1::text[])`,
			[ids],
		);

		const users: UserEntity[] = [];
		for (const row of rowsRes.rows) {
			const credits = await this.loadCredits(pool, row.id as UserId);
			users.push(postgresRowToUser(row, credits));
		}
		return users;
	}

	private async loadCredits(pool: PostgresPool, userId: UserId): Promise<string[]> {
		const result = await pool.query<{ referred_user_id: string }>(
			"SELECT referred_user_id FROM user_referral_credits WHERE referrer_id = $1",
			[userId],
		);
		return result.rows.map((row: { referred_user_id: string }) => row.referred_user_id);
	}

	private requirePool(): PostgresPool {
		if (!this.postgresPool) {
			throw new Error("Postgres pool is not initialized");
		}
		return this.postgresPool;
	}
}

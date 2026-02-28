import { Inject, Injectable } from "@nestjs/common";

import type {
	IdentityCursorPage,
	IdentityCursorPageInput,
	IdentityRepositoryPort,
} from "../../application/ports/identity-repository.port";
import type { IdentityEntity } from "../../domain/entities/identity.entity";
import type { TelegramIdentityId } from "../../domain/value-objects/telegram-identity-id";
import type { IdentityId } from "../../domain/value-objects/identity-id";
import { postgresRowToIdentity, type PostgresIdentityRow, identityToPostgresRow } from "../mappers/identity.mapper";
import { POSTGRES_POOL } from "../../../../../shared/persistence/postgres/postgres.constants";
import type { PostgresPool } from "../../../../../shared/persistence/postgres/postgres.provider";

@Injectable()
export class PostgresIdentityRepository implements IdentityRepositoryPort {
	constructor(@Inject(POSTGRES_POOL) private readonly postgresPool: PostgresPool | null) {}

	async getById(id: IdentityId): Promise<IdentityEntity | null> {
		const pool = this.requirePool();
		const rowRes = await pool.query<PostgresIdentityRow>(
			`SELECT id, telegram_id::text, username, first_name, last_name, created_at, updated_at
			 FROM identities
			 WHERE id = $1`,
			[id],
		);
		if (rowRes.rowCount === 0) {
			return null;
		}
		return postgresRowToIdentity(rowRes.rows[0]);
	}

	async findByTelegramId(telegramIdentityId: TelegramIdentityId): Promise<IdentityEntity | null> {
		const pool = this.requirePool();
		const rowRes = await pool.query<PostgresIdentityRow>(
			`SELECT id, telegram_id::text, username, first_name, last_name, created_at, updated_at
			 FROM identities
			 WHERE telegram_id = $1`,
			[String(telegramIdentityId)],
		);
		if (rowRes.rowCount === 0) {
			return null;
		}
		return postgresRowToIdentity(rowRes.rows[0]);
	}

	async listByCursor(input: IdentityCursorPageInput): Promise<IdentityCursorPage> {
		const pool = this.requirePool();
		const limit = Math.max(1, input.limit);
		const rowRes = await pool.query<PostgresIdentityRow>(
			`SELECT id, telegram_id::text, username, first_name, last_name, created_at, updated_at
			 FROM identities
			 WHERE ($1::text IS NULL OR id > $1)
				AND ($2::text IS NULL OR LOWER(COALESCE(username, '')) LIKE LOWER($2) || '%')
			 ORDER BY id ASC
			 LIMIT $3`,
			[input.cursor ?? null, input.usernamePrefix ?? null, limit],
		);

		return {
			items: rowRes.rows.map((row) => postgresRowToIdentity(row)),
			nextCursor: rowRes.rows.length < limit ? undefined : rowRes.rows[rowRes.rows.length - 1].id,
		};
	}

	async countByUsernamePrefix(usernamePrefix?: string): Promise<number> {
		const pool = this.requirePool();
		const countRes = await pool.query<{ count: string }>(
			`SELECT COUNT(*)::text AS count
			 FROM identities
			 WHERE ($1::text IS NULL OR LOWER(COALESCE(username, '')) LIKE LOWER($1) || '%')`,
			[usernamePrefix ?? null],
		);
		return Number.parseInt(countRes.rows[0]?.count ?? "0", 10);
	}

	async save(identity: IdentityEntity): Promise<void> {
		const pool = this.requirePool();
		const row = identityToPostgresRow(identity);
		await pool.query(
			`INSERT INTO identities (id, telegram_id, username, first_name, last_name, created_at, updated_at)
			 VALUES ($1,$2,$3,$4,$5,$6,$7)
			 ON CONFLICT (id)
			 DO UPDATE SET telegram_id = EXCLUDED.telegram_id,
				username = EXCLUDED.username,
				first_name = EXCLUDED.first_name,
				last_name = EXCLUDED.last_name,
				updated_at = EXCLUDED.updated_at`,
			[row.id, row.telegram_id, row.username, row.first_name, row.last_name, row.created_at, row.updated_at],
		);
	}

	async delete(id: IdentityId): Promise<void> {
		const pool = this.requirePool();
		await pool.query("DELETE FROM identities WHERE id = $1", [id]);
	}

	async listByIds(ids: readonly IdentityId[]): Promise<IdentityEntity[]> {
		if (ids.length === 0) {
			return [];
		}
		const pool = this.requirePool();
		const rowsRes = await pool.query<PostgresIdentityRow>(
			`SELECT id, telegram_id::text, username, first_name, last_name, created_at, updated_at
			 FROM identities
			 WHERE id = ANY($1::text[])`,
			[ids],
		);

		return rowsRes.rows.map((row) => postgresRowToIdentity(row));
	}

	private requirePool(): PostgresPool {
		if (!this.postgresPool) {
			throw new Error("Postgres pool is not initialized");
		}
		return this.postgresPool;
	}
}

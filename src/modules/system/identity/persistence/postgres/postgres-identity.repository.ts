import { Inject, Injectable } from "@nestjs/common";

import type {
	IdentityCursorPage,
	IdentityCursorPageInput,
	IdentityRepositoryPort,
} from "../../application/ports/identity-repository.port";
import type { IdentityEntity } from "../../domain/entities/identity.entity";
import type { TelegramIdentityId } from "../../domain/value-objects/telegram-identity-id";
import type { IdentityId } from "../../domain/value-objects/identity-id";
import { postgresRowToIdentity, identityToPostgresRow } from "../mappers/identity.mapper";
import { POSTGRES_DB } from "../../../../../shared/persistence/postgres/postgres.constants";
import { PostgresExecutionContextService } from "../../../../../shared/persistence/postgres/postgres-execution-context.service";
import type { PostgresDatabaseClient } from "../../../../../shared/persistence/postgres/postgres.provider";

@Injectable()
export class PostgresIdentityRepository implements IdentityRepositoryPort {
	constructor(
		@Inject(POSTGRES_DB) private readonly postgresDb: PostgresDatabaseClient | null,
		private readonly postgresExecutionContext: PostgresExecutionContextService,
	) {}

	async getById(id: IdentityId): Promise<IdentityEntity | null> {
		const row = await this.getClient().selectFrom("identities").selectAll().where("id", "=", id).executeTakeFirst();
		if (!row) {
			return null;
		}
		return postgresRowToIdentity(row);
	}

	async findByTelegramId(telegramIdentityId: TelegramIdentityId): Promise<IdentityEntity | null> {
		const row = await this.getClient()
			.selectFrom("identities")
			.selectAll()
			.where("telegram_id", "=", String(telegramIdentityId))
			.executeTakeFirst();
		if (!row) {
			return null;
		}
		return postgresRowToIdentity(row);
	}

	async listByCursor(input: IdentityCursorPageInput): Promise<IdentityCursorPage> {
		const limit = Math.max(1, input.limit);

		let query = this.getClient()
			.selectFrom("identities")
			.selectAll()
			.orderBy("id", "asc")
			.limit(limit);

		if (input.cursor) {
			query = query.where("id", ">", input.cursor);
		}
		if (input.usernamePrefix) {
			query = query.where("username", "ilike", `${input.usernamePrefix}%`);
		}

		const rows = await query.execute();

		return {
			items: rows.map((row) => postgresRowToIdentity(row)),
			nextCursor: rows.length < limit ? undefined : rows[rows.length - 1].id,
		};
	}

	async countByUsernamePrefix(usernamePrefix?: string): Promise<number> {
		let query = this.getClient()
			.selectFrom("identities")
			.select((expressionBuilder) => expressionBuilder.fn.countAll<string>().as("count"));
		if (usernamePrefix) {
			query = query.where("username", "ilike", `${usernamePrefix}%`);
		}

		const countRow = await query.executeTakeFirst();
		return Number.parseInt(countRow?.count ?? "0", 10);
	}

	async save(identity: IdentityEntity): Promise<void> {
		const row = identityToPostgresRow(identity);
		await this.getClient()
			.insertInto("identities")
			.values({
				id: row.id,
				telegram_id: row.telegram_id,
				status: row.status,
				username: row.username,
				first_name: row.first_name,
				last_name: row.last_name,
				created_at: row.created_at,
				updated_at: row.updated_at,
			})
			.onConflict((conflictBuilder) =>
				conflictBuilder.column("id").doUpdateSet({
					telegram_id: row.telegram_id,
					status: row.status,
					username: row.username,
					first_name: row.first_name,
					last_name: row.last_name,
					updated_at: row.updated_at,
				}),
			)
			.execute();
	}

	async delete(id: IdentityId): Promise<void> {
		await this.getClient().deleteFrom("identities").where("id", "=", id).execute();
	}

	async listByIds(ids: readonly IdentityId[]): Promise<IdentityEntity[]> {
		if (ids.length === 0) {
			return [];
		}
		const rows = await this.getClient().selectFrom("identities").selectAll().where("id", "in", [...ids]).execute();

		return rows.map((row) => postgresRowToIdentity(row));
	}

	private getClient(): PostgresDatabaseClient {
		if (!this.postgresDb) {
			throw new Error("Postgres Kysely client is not initialized");
		}
		return this.postgresExecutionContext.getClient(this.postgresDb);
	}
}

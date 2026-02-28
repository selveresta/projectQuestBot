import { Inject, Injectable } from "@nestjs/common";

import type { BroadcastCampaignRepositoryPort } from "../../application/ports/broadcast-campaign-repository.port";
import type { BroadcastCampaignEntity, BroadcastCampaignStatus } from "../../domain/entities/broadcast-campaign.entity";
import type { BroadcastCampaignId } from "../../domain/value-objects/broadcast-campaign-id";
import {
	broadcastCampaignToPostgresRow,
	postgresRowToBroadcastCampaign,
} from "../mappers/broadcast-campaign.mapper";
import { POSTGRES_DB } from "../../../../../shared/persistence/postgres/postgres.constants";
import { PostgresExecutionContextService } from "../../../../../shared/persistence/postgres/postgres-execution-context.service";
import type { PostgresDatabaseClient } from "../../../../../shared/persistence/postgres/postgres.provider";

@Injectable()
export class PostgresBroadcastCampaignRepository implements BroadcastCampaignRepositoryPort {
	constructor(
		@Inject(POSTGRES_DB) private readonly postgresDb: PostgresDatabaseClient | null,
		private readonly postgresExecutionContext: PostgresExecutionContextService,
	) {}

	async getById(id: BroadcastCampaignId): Promise<BroadcastCampaignEntity | null> {
		const row = await this.getClient()
			.selectFrom("broadcast_campaigns")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst();
		if (!row) {
			return null;
		}
		return postgresRowToBroadcastCampaign(row);
	}

	async save(campaign: BroadcastCampaignEntity): Promise<void> {
		const row = broadcastCampaignToPostgresRow(campaign);
		await this.getClient()
			.insertInto("broadcast_campaigns")
			.values({
				id: row.id,
				status: row.status,
				message_text: row.message_text,
				audience_username_prefix: row.audience_username_prefix,
				next_identity_cursor: row.next_identity_cursor,
				total_recipients: row.total_recipients,
				processed_recipients: row.processed_recipients,
				succeeded_recipients: row.succeeded_recipients,
				failed_recipients: row.failed_recipients,
				retry_count: row.retry_count,
				dlq_count: row.dlq_count,
				last_error_code: row.last_error_code,
				last_error_message: row.last_error_message,
				created_at: row.created_at,
				updated_at: row.updated_at,
				started_at: row.started_at,
				finished_at: row.finished_at,
			})
			.onConflict((conflictBuilder) =>
				conflictBuilder.column("id").doUpdateSet({
					status: row.status,
					message_text: row.message_text,
					audience_username_prefix: row.audience_username_prefix,
					next_identity_cursor: row.next_identity_cursor,
					total_recipients: row.total_recipients,
					processed_recipients: row.processed_recipients,
					succeeded_recipients: row.succeeded_recipients,
					failed_recipients: row.failed_recipients,
					retry_count: row.retry_count,
					dlq_count: row.dlq_count,
					last_error_code: row.last_error_code,
					last_error_message: row.last_error_message,
					updated_at: row.updated_at,
					started_at: row.started_at,
					finished_at: row.finished_at,
				}),
			)
			.execute();
	}

	async listByStatuses(
		statuses: readonly BroadcastCampaignStatus[],
		limit: number,
	): Promise<BroadcastCampaignEntity[]> {
		if (statuses.length === 0 || limit <= 0) {
			return [];
		}

		const rows = await this.getClient()
			.selectFrom("broadcast_campaigns")
			.selectAll()
			.where("status", "in", [...statuses])
			.orderBy("created_at", "desc")
			.limit(limit)
			.execute();

		return rows.map((row) => postgresRowToBroadcastCampaign(row));
	}

	async listRecent(limit: number): Promise<BroadcastCampaignEntity[]> {
		if (limit <= 0) {
			return [];
		}

		const rows = await this.getClient()
			.selectFrom("broadcast_campaigns")
			.selectAll()
			.orderBy("created_at", "desc")
			.limit(limit)
			.execute();
		return rows.map((row) => postgresRowToBroadcastCampaign(row));
	}

	private getClient(): PostgresDatabaseClient {
		if (!this.postgresDb) {
			throw new Error("Postgres Kysely client is not initialized");
		}
		return this.postgresExecutionContext.getClient(this.postgresDb);
	}
}

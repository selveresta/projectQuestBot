import { Inject, Injectable } from "@nestjs/common";

import type { BroadcastCampaignRepositoryPort } from "../../application/ports/broadcast-campaign-repository.port";
import type { BroadcastCampaignEntity, BroadcastCampaignStatus } from "../../domain/entities/broadcast-campaign.entity";
import type { BroadcastCampaignId } from "../../domain/value-objects/broadcast-campaign-id";
import {
	broadcastCampaignToPostgresRow,
	postgresRowToBroadcastCampaign,
	type PostgresBroadcastCampaignRow,
} from "../mappers/broadcast-campaign.mapper";
import { POSTGRES_POOL } from "../../../../../shared/persistence/postgres/postgres.constants";
import type { PostgresPool } from "../../../../../shared/persistence/postgres/postgres.provider";

@Injectable()
export class PostgresBroadcastCampaignRepository implements BroadcastCampaignRepositoryPort {
	constructor(@Inject(POSTGRES_POOL) private readonly postgresPool: PostgresPool | null) {}

	async getById(id: BroadcastCampaignId): Promise<BroadcastCampaignEntity | null> {
		const pool = this.requirePool();
		const result = await pool.query<PostgresBroadcastCampaignRow>(
			`SELECT id, status, message_text, audience_username_prefix, next_identity_cursor,
				total_recipients, processed_recipients, succeeded_recipients, failed_recipients,
				retry_count, dlq_count, last_error_code, last_error_message,
				created_at, updated_at, started_at, finished_at
			 FROM broadcast_campaigns
			 WHERE id = $1`,
			[id],
		);

		if (result.rowCount === 0) {
			return null;
		}
		return postgresRowToBroadcastCampaign(result.rows[0]);
	}

	async save(campaign: BroadcastCampaignEntity): Promise<void> {
		const pool = this.requirePool();
		const row = broadcastCampaignToPostgresRow(campaign);
		await pool.query(
			`INSERT INTO broadcast_campaigns (
				id, status, message_text, audience_username_prefix, next_identity_cursor,
				total_recipients, processed_recipients, succeeded_recipients, failed_recipients,
				retry_count, dlq_count, last_error_code, last_error_message,
				created_at, updated_at, started_at, finished_at
			) VALUES (
				$1,$2,$3,$4,$5,
				$6,$7,$8,$9,
				$10,$11,$12,$13,
				$14,$15,$16,$17
			)
			ON CONFLICT (id) DO UPDATE SET
				status = EXCLUDED.status,
				message_text = EXCLUDED.message_text,
				audience_username_prefix = EXCLUDED.audience_username_prefix,
				next_identity_cursor = EXCLUDED.next_identity_cursor,
				total_recipients = EXCLUDED.total_recipients,
				processed_recipients = EXCLUDED.processed_recipients,
				succeeded_recipients = EXCLUDED.succeeded_recipients,
				failed_recipients = EXCLUDED.failed_recipients,
				retry_count = EXCLUDED.retry_count,
				dlq_count = EXCLUDED.dlq_count,
				last_error_code = EXCLUDED.last_error_code,
				last_error_message = EXCLUDED.last_error_message,
				updated_at = EXCLUDED.updated_at,
				started_at = EXCLUDED.started_at,
				finished_at = EXCLUDED.finished_at`,
			[
				row.id,
				row.status,
				row.message_text,
				row.audience_username_prefix,
				row.next_identity_cursor,
				row.total_recipients,
				row.processed_recipients,
				row.succeeded_recipients,
				row.failed_recipients,
				row.retry_count,
				row.dlq_count,
				row.last_error_code,
				row.last_error_message,
				row.created_at,
				row.updated_at,
				row.started_at,
				row.finished_at,
			],
		);
	}

	async listByStatuses(
		statuses: readonly BroadcastCampaignStatus[],
		limit: number,
	): Promise<BroadcastCampaignEntity[]> {
		if (statuses.length === 0 || limit <= 0) {
			return [];
		}

		const pool = this.requirePool();
		const result = await pool.query<PostgresBroadcastCampaignRow>(
			`SELECT id, status, message_text, audience_username_prefix, next_identity_cursor,
				total_recipients, processed_recipients, succeeded_recipients, failed_recipients,
				retry_count, dlq_count, last_error_code, last_error_message,
				created_at, updated_at, started_at, finished_at
			 FROM broadcast_campaigns
			 WHERE status = ANY($1::text[])
			 ORDER BY created_at DESC
			 LIMIT $2`,
			[statuses, limit],
		);

		return result.rows.map((row) => postgresRowToBroadcastCampaign(row));
	}

	async listRecent(limit: number): Promise<BroadcastCampaignEntity[]> {
		if (limit <= 0) {
			return [];
		}

		const pool = this.requirePool();
		const result = await pool.query<PostgresBroadcastCampaignRow>(
			`SELECT id, status, message_text, audience_username_prefix, next_identity_cursor,
				total_recipients, processed_recipients, succeeded_recipients, failed_recipients,
				retry_count, dlq_count, last_error_code, last_error_message,
				created_at, updated_at, started_at, finished_at
			 FROM broadcast_campaigns
			 ORDER BY created_at DESC
			 LIMIT $1`,
			[limit],
		);
		return result.rows.map((row) => postgresRowToBroadcastCampaign(row));
	}

	private requirePool(): PostgresPool {
		if (!this.postgresPool) {
			throw new Error("Postgres pool is not initialized");
		}
		return this.postgresPool;
	}
}

import {
	BroadcastCampaignEntity,
	type BroadcastCampaignSnapshot,
	type BroadcastCampaignStatus,
} from "../../domain/entities/broadcast-campaign.entity";
import { toBroadcastCampaignId } from "../../domain/value-objects/broadcast-campaign-id";
import { toIsoDateString } from "../../../../../shared/domain/iso-date";

export type RedisBroadcastCampaignHash = Record<string, string> & {
	id: string;
	status: BroadcastCampaignStatus;
	message_text: string;
	audience_username_prefix: string;
	next_identity_cursor: string;
	total_recipients: string;
	processed_recipients: string;
	succeeded_recipients: string;
	failed_recipients: string;
	retry_count: string;
	dlq_count: string;
	last_error_code: string;
	last_error_message: string;
	created_at: string;
	updated_at: string;
	started_at: string;
	finished_at: string;
};

export interface PostgresBroadcastCampaignRow {
	id: string;
	status: BroadcastCampaignStatus;
	message_text: string;
	audience_username_prefix: string | null;
	next_identity_cursor: string | null;
	total_recipients: number;
	processed_recipients: number;
	succeeded_recipients: number;
	failed_recipients: number;
	retry_count: number;
	dlq_count: number;
	last_error_code: string | null;
	last_error_message: string | null;
	created_at: string;
	updated_at: string;
	started_at: string | null;
	finished_at: string | null;
}

export function broadcastCampaignToRedisHash(entity: BroadcastCampaignEntity): RedisBroadcastCampaignHash {
	const snapshot = entity.toSnapshot();
	return {
		id: snapshot.id,
		status: snapshot.status,
		message_text: snapshot.messageText,
		audience_username_prefix: snapshot.audienceUsernamePrefix ?? "",
		next_identity_cursor: snapshot.nextIdentityCursor ?? "",
		total_recipients: String(snapshot.totalRecipients),
		processed_recipients: String(snapshot.processedRecipients),
		succeeded_recipients: String(snapshot.succeededRecipients),
		failed_recipients: String(snapshot.failedRecipients),
		retry_count: String(snapshot.retryCount),
		dlq_count: String(snapshot.dlqCount),
		last_error_code: snapshot.lastErrorCode ?? "",
		last_error_message: snapshot.lastErrorMessage ?? "",
		created_at: snapshot.createdAt,
		updated_at: snapshot.updatedAt,
		started_at: snapshot.startedAt ?? "",
		finished_at: snapshot.finishedAt ?? "",
	};
}

export function redisHashToBroadcastCampaign(hash: Record<string, string>): BroadcastCampaignEntity | null {
	if (!hash.id || !hash.status || !hash.message_text || !hash.created_at || !hash.updated_at) {
		return null;
	}

	return BroadcastCampaignEntity.rehydrate({
		id: toBroadcastCampaignId(hash.id),
		status: hash.status as BroadcastCampaignStatus,
		messageText: hash.message_text,
		audienceUsernamePrefix: hash.audience_username_prefix || undefined,
		nextIdentityCursor: hash.next_identity_cursor || undefined,
		totalRecipients: Number.parseInt(hash.total_recipients || "0", 10),
		processedRecipients: Number.parseInt(hash.processed_recipients || "0", 10),
		succeededRecipients: Number.parseInt(hash.succeeded_recipients || "0", 10),
		failedRecipients: Number.parseInt(hash.failed_recipients || "0", 10),
		retryCount: Number.parseInt(hash.retry_count || "0", 10),
		dlqCount: Number.parseInt(hash.dlq_count || "0", 10),
		lastErrorCode: hash.last_error_code || undefined,
		lastErrorMessage: hash.last_error_message || undefined,
		createdAt: toIsoDateString(hash.created_at),
		updatedAt: toIsoDateString(hash.updated_at),
		startedAt: hash.started_at ? toIsoDateString(hash.started_at) : undefined,
		finishedAt: hash.finished_at ? toIsoDateString(hash.finished_at) : undefined,
	});
}

export function broadcastCampaignToPostgresRow(entity: BroadcastCampaignEntity): PostgresBroadcastCampaignRow {
	const snapshot = entity.toSnapshot();
	return {
		id: snapshot.id,
		status: snapshot.status,
		message_text: snapshot.messageText,
		audience_username_prefix: snapshot.audienceUsernamePrefix ?? null,
		next_identity_cursor: snapshot.nextIdentityCursor ?? null,
		total_recipients: snapshot.totalRecipients,
		processed_recipients: snapshot.processedRecipients,
		succeeded_recipients: snapshot.succeededRecipients,
		failed_recipients: snapshot.failedRecipients,
		retry_count: snapshot.retryCount,
		dlq_count: snapshot.dlqCount,
		last_error_code: snapshot.lastErrorCode ?? null,
		last_error_message: snapshot.lastErrorMessage ?? null,
		created_at: snapshot.createdAt,
		updated_at: snapshot.updatedAt,
		started_at: snapshot.startedAt ?? null,
		finished_at: snapshot.finishedAt ?? null,
	};
}

export function postgresRowToBroadcastCampaign(row: PostgresBroadcastCampaignRow): BroadcastCampaignEntity {
	const snapshot: BroadcastCampaignSnapshot = {
		id: toBroadcastCampaignId(row.id),
		status: row.status,
		messageText: row.message_text,
		audienceUsernamePrefix: row.audience_username_prefix ?? undefined,
		nextIdentityCursor: row.next_identity_cursor ?? undefined,
		totalRecipients: row.total_recipients,
		processedRecipients: row.processed_recipients,
		succeededRecipients: row.succeeded_recipients,
		failedRecipients: row.failed_recipients,
		retryCount: row.retry_count,
		dlqCount: row.dlq_count,
		lastErrorCode: row.last_error_code ?? undefined,
		lastErrorMessage: row.last_error_message ?? undefined,
		createdAt: toIsoDateString(row.created_at),
		updatedAt: toIsoDateString(row.updated_at),
		startedAt: row.started_at ? toIsoDateString(row.started_at) : undefined,
		finishedAt: row.finished_at ? toIsoDateString(row.finished_at) : undefined,
	};

	return BroadcastCampaignEntity.rehydrate(snapshot);
}

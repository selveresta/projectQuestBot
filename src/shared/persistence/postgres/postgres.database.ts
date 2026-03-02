export interface IdentitiesTable {
	id: string;
	telegram_id: string;
	status: string;
	username: string | null;
	first_name: string | null;
	last_name: string | null;
	created_at: string;
	updated_at: string;
}

export interface BroadcastCampaignsTable {
	id: string;
	status: string;
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

export interface PostgresDatabase {
	identities: IdentitiesTable;
	broadcast_campaigns: BroadcastCampaignsTable;
}

import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";

import { AppConfigService } from "../../../../../shared/config/app-config.service";
import { POSTGRES_POOL } from "../../../../../shared/persistence/postgres/postgres.constants";
import type { PostgresPool } from "../../../../../shared/persistence/postgres/postgres.provider";

@Injectable()
export class PostgresBroadcastBootstrapService implements OnModuleInit {
	constructor(
		@Inject(POSTGRES_POOL) private readonly postgresPool: PostgresPool | null,
		private readonly config: AppConfigService,
	) {}

	async onModuleInit(): Promise<void> {
		if (this.config.primaryDb !== "postgres" || !this.postgresPool) {
			return;
		}

		await this.postgresPool.query(`
			CREATE TABLE IF NOT EXISTS broadcast_campaigns (
				id TEXT PRIMARY KEY,
				status TEXT NOT NULL,
				message_text TEXT NOT NULL,
				audience_username_prefix TEXT NULL,
				next_identity_cursor TEXT NULL,
				total_recipients INTEGER NOT NULL DEFAULT 0,
				processed_recipients INTEGER NOT NULL DEFAULT 0,
				succeeded_recipients INTEGER NOT NULL DEFAULT 0,
				failed_recipients INTEGER NOT NULL DEFAULT 0,
				retry_count INTEGER NOT NULL DEFAULT 0,
				dlq_count INTEGER NOT NULL DEFAULT 0,
				last_error_code TEXT NULL,
				last_error_message TEXT NULL,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL,
				started_at TEXT NULL,
				finished_at TEXT NULL
			);
		`);

		await this.postgresPool.query(`
			CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_status
			ON broadcast_campaigns(status);
		`);
		await this.postgresPool.query(`
			CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_created_at
			ON broadcast_campaigns(created_at DESC);
		`);
	}
}

import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";

import { AppConfigService } from "../../config/app-config.service";
import { POSTGRES_POOL } from "./postgres.constants";
import type { PostgresPool } from "./postgres.provider";

@Injectable()
export class PostgresBootstrapService implements OnModuleInit {
	constructor(
		@Inject(POSTGRES_POOL) private readonly postgresPool: PostgresPool | null,
		private readonly config: AppConfigService,
	) {}

	async onModuleInit(): Promise<void> {
		if (this.config.primaryDb !== "postgres" || !this.postgresPool) {
			return;
		}

		await this.postgresPool.query(`
			CREATE TABLE IF NOT EXISTS identities (
				id TEXT PRIMARY KEY,
				telegram_id BIGINT NOT NULL UNIQUE,
				username TEXT NULL,
				first_name TEXT NULL,
				last_name TEXT NULL,
				points INTEGER NOT NULL DEFAULT 0,
				referred_by TEXT NULL REFERENCES identities(id),
				referral_bonus_claimed BOOLEAN NOT NULL DEFAULT FALSE,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);
		`);

		await this.postgresPool.query(`
			ALTER TABLE identities
			ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0;
		`);
		await this.postgresPool.query(`
			ALTER TABLE identities
			ADD COLUMN IF NOT EXISTS referred_by TEXT NULL REFERENCES identities(id);
		`);
		await this.postgresPool.query(`
			ALTER TABLE identities
			ADD COLUMN IF NOT EXISTS referral_bonus_claimed BOOLEAN NOT NULL DEFAULT FALSE;
		`);

		await this.postgresPool.query(`
			CREATE TABLE IF NOT EXISTS identity_referral_credits (
				referrer_id TEXT NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
				referred_identity_id TEXT NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
				PRIMARY KEY (referrer_id, referred_identity_id)
			);
		`);
	}
}

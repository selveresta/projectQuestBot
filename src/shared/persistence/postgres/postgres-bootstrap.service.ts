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
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);
		`);
	}
}

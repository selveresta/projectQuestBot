import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";

import { AppConfigService } from "../../../../../shared/config/app-config.service";
import { POSTGRES_DB } from "../../../../../shared/persistence/postgres/postgres.constants";
import type { PostgresDatabaseClient } from "../../../../../shared/persistence/postgres/postgres.provider";

@Injectable()
export class PostgresBroadcastBootstrapService implements OnModuleInit {
	constructor(
		@Inject(POSTGRES_DB) private readonly postgresDb: PostgresDatabaseClient | null,
		private readonly config: AppConfigService,
	) {}

	async onModuleInit(): Promise<void> {
		if (this.config.primaryDb !== "postgres" || !this.postgresDb) {
			return;
		}

		await this.postgresDb.schema
			.createTable("broadcast_campaigns")
			.ifNotExists()
			.addColumn("id", "text", (column) => column.primaryKey())
			.addColumn("status", "text", (column) => column.notNull())
			.addColumn("message_text", "text", (column) => column.notNull())
			.addColumn("audience_username_prefix", "text")
			.addColumn("next_identity_cursor", "text")
			.addColumn("total_recipients", "integer", (column) => column.notNull().defaultTo(0))
			.addColumn("processed_recipients", "integer", (column) => column.notNull().defaultTo(0))
			.addColumn("succeeded_recipients", "integer", (column) => column.notNull().defaultTo(0))
			.addColumn("failed_recipients", "integer", (column) => column.notNull().defaultTo(0))
			.addColumn("retry_count", "integer", (column) => column.notNull().defaultTo(0))
			.addColumn("dlq_count", "integer", (column) => column.notNull().defaultTo(0))
			.addColumn("last_error_code", "text")
			.addColumn("last_error_message", "text")
			.addColumn("created_at", "text", (column) => column.notNull())
			.addColumn("updated_at", "text", (column) => column.notNull())
			.addColumn("started_at", "text")
			.addColumn("finished_at", "text")
			.execute();

		await this.postgresDb.schema
			.createIndex("idx_broadcast_campaigns_status")
			.ifNotExists()
			.on("broadcast_campaigns")
			.column("status")
			.execute();
		await this.postgresDb.schema
			.createIndex("idx_broadcast_campaigns_created_at")
			.ifNotExists()
			.on("broadcast_campaigns")
			.column("created_at")
			.execute();
	}
}

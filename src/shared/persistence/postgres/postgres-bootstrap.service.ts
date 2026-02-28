import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";

import { AppConfigService } from "../../config/app-config.service";
import { POSTGRES_DB } from "./postgres.constants";
import type { PostgresDatabaseClient } from "./postgres.provider";

@Injectable()
export class PostgresBootstrapService implements OnModuleInit {
	constructor(
		@Inject(POSTGRES_DB) private readonly postgresDb: PostgresDatabaseClient | null,
		private readonly config: AppConfigService,
	) {}

	async onModuleInit(): Promise<void> {
		if (this.config.primaryDb !== "postgres" || !this.postgresDb) {
			return;
		}

		await this.postgresDb.schema
			.createTable("identities")
			.ifNotExists()
			.addColumn("id", "text", (column) => column.primaryKey())
			.addColumn("telegram_id", "bigint", (column) => column.notNull().unique())
			.addColumn("username", "text")
			.addColumn("first_name", "text")
			.addColumn("last_name", "text")
			.addColumn("created_at", "text", (column) => column.notNull())
			.addColumn("updated_at", "text", (column) => column.notNull())
			.execute();
	}
}

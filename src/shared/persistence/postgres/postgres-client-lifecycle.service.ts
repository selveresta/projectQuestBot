import { Inject, Injectable, type OnApplicationShutdown } from "@nestjs/common";

import { PinoLoggerService } from "../../adapters/logger/pino-logger.service";
import { POSTGRES_DB } from "./postgres.constants";
import type { PostgresDatabaseClient } from "./postgres.provider";

@Injectable()
export class PostgresClientLifecycleService implements OnApplicationShutdown {
	constructor(
		@Inject(POSTGRES_DB) private readonly postgresDb: PostgresDatabaseClient | null,
		private readonly logger: PinoLoggerService,
	) {}

	async onApplicationShutdown(): Promise<void> {
		if (!this.postgresDb) {
			return;
		}

		await this.postgresDb.destroy();
		this.logger.log("Postgres Kysely connection closed");
	}
}

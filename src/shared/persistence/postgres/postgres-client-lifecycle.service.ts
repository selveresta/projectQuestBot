import { Inject, Injectable, type OnApplicationShutdown } from "@nestjs/common";

import { PinoLoggerService } from "../../adapters/logger/pino-logger.service";
import { POSTGRES_POOL } from "./postgres.constants";
import type { PostgresPool } from "./postgres.provider";

@Injectable()
export class PostgresClientLifecycleService implements OnApplicationShutdown {
	constructor(
		@Inject(POSTGRES_POOL) private readonly postgresPool: PostgresPool | null,
		private readonly logger: PinoLoggerService,
	) {}

	async onApplicationShutdown(): Promise<void> {
		if (!this.postgresPool) {
			return;
		}

		await this.postgresPool.end();
		this.logger.log("Postgres pool closed");
	}
}

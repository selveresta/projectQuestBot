import type { Provider } from "@nestjs/common";
import { Pool } from "pg";

import { PinoLoggerService } from "../../adapters/logger/pino-logger.service";
import { AppConfigService } from "../../config/app-config.service";
import { POSTGRES_POOL } from "./postgres.constants";

export type PostgresPool = Pool;

export const postgresPoolProvider: Provider = {
	provide: POSTGRES_POOL,
	inject: [AppConfigService, PinoLoggerService],
	useFactory: async (config: AppConfigService, logger: PinoLoggerService): Promise<PostgresPool | null> => {
		if (config.primaryDb !== "postgres") {
			return null;
		}
		if (!config.postgresUrl) {
			throw new Error("POSTGRES_URL is required when PRIMARY_DB=postgres");
		}

		const pool = new Pool({ connectionString: config.postgresUrl });
		await pool.query("SELECT 1");
		logger.log("Postgres connected");
		return pool;
	},
};

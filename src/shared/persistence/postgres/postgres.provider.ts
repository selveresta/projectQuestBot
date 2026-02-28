import type { Provider } from "@nestjs/common";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

import { PinoLoggerService } from "../../adapters/logger/pino-logger.service";
import { AppConfigService } from "../../config/app-config.service";
import { POSTGRES_DB } from "./postgres.constants";
import type { PostgresDatabase } from "./postgres.database";

export type PostgresDatabaseClient = Kysely<PostgresDatabase>;

export const postgresDatabaseProvider: Provider = {
	provide: POSTGRES_DB,
	inject: [AppConfigService, PinoLoggerService],
	useFactory: async (
		config: AppConfigService,
		logger: PinoLoggerService,
	): Promise<PostgresDatabaseClient | null> => {
		if (config.primaryDb !== "postgres") {
			return null;
		}
		if (!config.postgresUrl) {
			throw new Error("POSTGRES_URL is required when PRIMARY_DB=postgres");
		}

		const pool = new Pool({
			connectionString: config.postgresUrl,
			min: config.postgresPoolMin,
			max: config.postgresPoolMax,
		});

		const db = new Kysely<PostgresDatabase>({
			dialect: new PostgresDialect({
				pool,
			}),
		});

		logger.log("Postgres Kysely connected");
		return db;
	},
};

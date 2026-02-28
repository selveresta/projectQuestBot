import { Inject, Injectable } from "@nestjs/common";

import type { TransactionManagerPort } from "../../application/ports/transaction-manager.port";
import { AppConfigService } from "../../config/app-config.service";
import { POSTGRES_DB } from "../../persistence/postgres/postgres.constants";
import { PostgresExecutionContextService } from "../../persistence/postgres/postgres-execution-context.service";
import type { PostgresDatabaseClient } from "../../persistence/postgres/postgres.provider";

@Injectable()
export class PostgresTransactionManagerAdapter implements TransactionManagerPort {
	constructor(
		@Inject(POSTGRES_DB) private readonly postgresDb: PostgresDatabaseClient | null,
		private readonly postgresExecutionContext: PostgresExecutionContextService,
		private readonly config: AppConfigService,
	) {}

	async runInTransaction<TResult>(work: () => Promise<TResult>): Promise<TResult> {
		if (this.config.primaryDb !== "postgres") {
			return work();
		}
		if (!this.postgresDb) {
			throw new Error("Postgres database client is not available");
		}

		return this.postgresExecutionContext.runInTransaction(this.postgresDb, work);
	}
}

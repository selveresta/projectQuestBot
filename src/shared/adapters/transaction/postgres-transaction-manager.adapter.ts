import { Inject, Injectable } from "@nestjs/common";

import type { TransactionManagerPort } from "../../application/ports/transaction-manager.port";
import { AppConfigService } from "../../config/app-config.service";
import { POSTGRES_POOL } from "../../persistence/postgres/postgres.constants";
import type { PostgresPool } from "../../persistence/postgres/postgres.provider";

@Injectable()
export class PostgresTransactionManagerAdapter implements TransactionManagerPort {
	constructor(
		@Inject(POSTGRES_POOL) private readonly postgresPool: PostgresPool | null,
		private readonly config: AppConfigService,
	) {}

	async runInTransaction<TResult>(work: () => Promise<TResult>): Promise<TResult> {
		if (this.config.primaryDb !== "postgres") {
			return work();
		}
		if (!this.postgresPool) {
			throw new Error("Postgres pool is not available");
		}

		const client = await this.postgresPool.connect();
		try {
			await client.query("BEGIN");
			const result = await work();
			await client.query("COMMIT");
			return result;
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		} finally {
			client.release();
		}
	}
}

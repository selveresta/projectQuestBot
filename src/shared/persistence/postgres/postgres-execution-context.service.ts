import { AsyncLocalStorage } from "node:async_hooks";

import { Injectable } from "@nestjs/common";
import type { PostgresDatabaseClient } from "./postgres.provider";

@Injectable()
export class PostgresExecutionContextService {
	private readonly storage = new AsyncLocalStorage<PostgresDatabaseClient>();

	getClient(defaultClient: PostgresDatabaseClient): PostgresDatabaseClient {
		return this.storage.getStore() ?? defaultClient;
	}

	async runInTransaction<TResult>(db: PostgresDatabaseClient, work: () => Promise<TResult>): Promise<TResult> {
		return db.transaction().execute(async (transaction) => this.storage.run(transaction as PostgresDatabaseClient, work));
	}
}

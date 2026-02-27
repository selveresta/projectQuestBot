import { Injectable } from "@nestjs/common";

import type { TransactionManagerPort } from "../../application/ports/transaction-manager.port";

@Injectable()
export class NoopTransactionManagerAdapter implements TransactionManagerPort {
	async runInTransaction<TResult>(work: () => Promise<TResult>): Promise<TResult> {
		return work();
	}
}

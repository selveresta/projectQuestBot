export const TRANSACTION_MANAGER_PORT = Symbol("TRANSACTION_MANAGER_PORT");

export interface TransactionManagerPort {
	runInTransaction<TResult>(work: () => Promise<TResult>): Promise<TResult>;
}

export { TRANSACTION_MANAGER_PORT } from "../../di/tokens";

export interface TransactionManagerPort {
	runInTransaction<TResult>(work: () => Promise<TResult>): Promise<TResult>;
}

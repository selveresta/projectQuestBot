export interface IdempotencyRepositoryPort {
	acquireUpdate(updateId: number): Promise<boolean>;
}

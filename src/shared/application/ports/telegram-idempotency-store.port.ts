export const TELEGRAM_IDEMPOTENCY_PORT = Symbol("TELEGRAM_IDEMPOTENCY_PORT");

export interface TelegramIdempotencyStorePort {
	acquire(updateId: number, ttlSeconds: number): Promise<boolean>;
}

export { TELEGRAM_IDEMPOTENCY_PORT } from "../../di/tokens";

export interface TelegramIdempotencyStorePort {
	acquire(updateId: number, ttlSeconds: number): Promise<boolean>;
}

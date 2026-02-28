export { IDEMPOTENCY_KEY_PORT } from "../../di/tokens";

export interface IdempotencyKeyPort {
	acquire(key: string, ttlSeconds: number): Promise<boolean>;
	release(key: string): Promise<void>;
}

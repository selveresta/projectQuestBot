import type { StorageAdapter } from "grammy";

export { TELEGRAM_SESSION_STORE_PORT } from "../../di/tokens";

export interface TelegramSessionStorePort {
	createStorageAdapter<TSession extends object>(): StorageAdapter<TSession>;
}

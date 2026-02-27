import type { StorageAdapter } from "grammy";

export const TELEGRAM_SESSION_STORE_PORT = Symbol("TELEGRAM_SESSION_STORE_PORT");

export interface TelegramSessionStorePort {
	createStorageAdapter<TSession extends object>(): StorageAdapter<TSession>;
}

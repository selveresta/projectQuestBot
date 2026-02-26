import type { StorageAdapter } from "grammy";

export interface SessionStorePort {
	createStorageAdapter<TSession extends object>(): StorageAdapter<TSession>;
}

export const CACHE_PORT = Symbol("CACHE_PORT");

export interface CachePort {
	get<T>(key: string): Promise<T | null>;
	set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
	del(key: string): Promise<void>;
	wrap<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T>;
}

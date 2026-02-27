export { CACHE_PORT } from "../../di/tokens";

export interface CachePort {
	get<T>(key: string): Promise<T | null>;
	set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
	del(key: string): Promise<void>;
	wrap<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T>;
}

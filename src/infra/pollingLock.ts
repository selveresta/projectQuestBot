import { randomUUID } from "node:crypto";

import type { RedisClient } from "./redis";

const DEFAULT_LOCK_KEY = "bot:polling:lock";
const DEFAULT_TTL_MS = 30_000;
const REFRESH_FRACTION = 0.5;

export class PollingLock {
	private readonly key: string;
	private readonly ttlMs: number;
	private readonly refreshIntervalMs: number;
	private refreshTimer: NodeJS.Timeout | null = null;
	private token: string | null = null;

	constructor(private readonly redis: RedisClient, options?: { key?: string; ttlMs?: number }) {
		this.key = options?.key ?? DEFAULT_LOCK_KEY;
		this.ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
		this.refreshIntervalMs = Math.max(1_000, Math.floor(this.ttlMs * REFRESH_FRACTION));
	}

	async acquire(): Promise<void> {
		if (this.token) {
			throw new Error("Polling lock already acquired");
		}
		const token = randomUUID();
		const result = await this.redis.set(this.key, token, { NX: true, PX: this.ttlMs });

		if (result !== "OK") {
			throw new Error("Bot long polling is already running");
		}

		this.token = token;
		this.startRefreshLoop();
	}

	async release(): Promise<void> {
		if (!this.token) {
			return;
		}

		this.stopRefreshLoop();
		try {
			await this.redis.eval(
				'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end',
				{
					keys: [this.key],
					arguments: [this.token],
				}
			);
		} catch (error) {
			console.error("[lock] failed to release polling lock", error);
		} finally {
			this.token = null;
		}
	}

	private startRefreshLoop(): void {
		this.stopRefreshLoop();
		this.refreshTimer = setInterval(() => {
			void this.refresh();
		}, this.refreshIntervalMs);
		this.refreshTimer.unref?.();
	}

	private stopRefreshLoop(): void {
		if (this.refreshTimer) {
			clearInterval(this.refreshTimer);
			this.refreshTimer = null;
		}
	}

	private async refresh(): Promise<void> {
		if (!this.token) {
			return;
		}

		try {
			const current = await this.redis.get(this.key);
			if (current !== this.token) {
				this.stopRefreshLoop();
				if (current !== null) {
					console.warn("[lock] polling lock token changed unexpectedly; stopping refresh loop");
				}
				return;
			}
			await this.redis.pexpire(this.key, this.ttlMs);
		} catch (error) {
			console.error("[lock] failed to refresh polling lock", error);
		}
	}
}

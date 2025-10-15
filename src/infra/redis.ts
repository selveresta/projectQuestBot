import { createClient } from "redis";

export type RedisClient = ReturnType<typeof createClient>;

class RedisManager {
	private static instance: RedisManager | null = null;

	static shared(): RedisManager {
		if (!RedisManager.instance) {
			RedisManager.instance = new RedisManager();
		}
		return RedisManager.instance;
	}

	private client: RedisClient | null = null;
	private url: string | null = null;
	private referenceCount = 0;

	private constructor() {}

	async acquire(url: string): Promise<RedisClient> {
		if (!this.client) {
			this.client = await this.connect(url);
			this.url = url;
		} else if (this.url && this.url !== url) {
			throw new Error(`RedisManager already initialised with URL ${this.url} but received ${url}`);
		} else if (!this.client.isOpen) {
			await this.client.connect();
		}

		this.referenceCount += 1;
		return this.client;
	}

	async release(): Promise<void> {
		if (!this.client) {
			return;
		}
		this.referenceCount = Math.max(this.referenceCount - 1, 0);
		if (this.referenceCount > 0) {
			return;
		}
		try {
			await this.client.quit();
		} finally {
			this.client = null;
			this.url = null;
		}
	}

	private async connect(url: string): Promise<RedisClient> {
		const client = createClient({ url });
		client.on("error", (error) => {
			console.error("[redis] connection error", error);
		});
		await client.connect();
		return client;
	}
}

export async function acquireRedisClient(url: string): Promise<RedisClient> {
	return RedisManager.shared().acquire(url);
}

export async function releaseRedisClient(): Promise<void> {
	await RedisManager.shared().release();
}

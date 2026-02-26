import { Inject, Injectable } from "@nestjs/common";

import { AppConfigService } from "../../config/app-config.service";
import type { IdempotencyRepositoryPort } from "../application/ports/idempotency-repository.port";
import { REDIS_CLIENT } from "../telegram.constants";
import type { RedisClient } from "./redis.provider";

@Injectable()
export class RedisIdempotencyRepository implements IdempotencyRepositoryPort {
	constructor(
		@Inject(REDIS_CLIENT) private readonly redis: RedisClient,
		private readonly config: AppConfigService,
	) {}

	async acquireUpdate(updateId: number): Promise<boolean> {
		const result = await this.redis.set(this.key(updateId), "1", {
			EX: this.config.idempotencyTtlSeconds,
			NX: true,
		});
		return result === "OK";
	}

	private key(updateId: number): string {
		return `telegram:update:${updateId}`;
	}
}

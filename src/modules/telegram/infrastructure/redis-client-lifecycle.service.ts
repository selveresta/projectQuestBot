import { Inject, Injectable, type OnApplicationShutdown } from "@nestjs/common";

import { PinoLoggerService } from "../../../common/logger/pino-logger.service";
import { REDIS_CLIENT } from "../telegram.constants";
import type { RedisClient } from "./redis.provider";

@Injectable()
export class RedisClientLifecycleService implements OnApplicationShutdown {
	constructor(
		@Inject(REDIS_CLIENT) private readonly redis: RedisClient,
		private readonly logger: PinoLoggerService
	) {}

	async onApplicationShutdown(): Promise<void> {
		if (!this.redis.isOpen) {
			return;
		}

		await this.redis.quit();
		this.logger.log("Redis connection closed");
	}
}

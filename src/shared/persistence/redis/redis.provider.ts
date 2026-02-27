import type { Provider } from "@nestjs/common";
import { createClient, type RedisClientType } from "redis";

import { PinoLoggerService } from "../../adapters/logger/pino-logger.service";
import { AppConfigService } from "../../config/app-config.service";
import { REDIS_CLIENT } from "./redis.constants";

export type RedisClient = RedisClientType;

export const redisClientProvider: Provider = {
	provide: REDIS_CLIENT,
	inject: [AppConfigService, PinoLoggerService],
	useFactory: async (config: AppConfigService, logger: PinoLoggerService): Promise<RedisClient> => {
		const client: RedisClient = createClient({ url: config.redisUrl });
		client.on("error", (error: unknown) => {
			logger.error("Redis client error", error);
		});

		await client.connect();
		logger.log(`Redis connected (${config.redisUrl})`);
		return client;
	},
};

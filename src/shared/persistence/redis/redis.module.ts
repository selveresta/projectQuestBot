import { Global, Module } from "@nestjs/common";

import { redisClientProvider } from "./redis.provider";
import { RedisClientLifecycleService } from "./redis-client-lifecycle.service";
import { REDIS_CLIENT } from "./redis.constants";

@Global()
@Module({
	providers: [redisClientProvider, RedisClientLifecycleService],
	exports: [REDIS_CLIENT],
})
export class RedisModule {}

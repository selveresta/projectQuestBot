import { Module } from "@nestjs/common";

import { GetIdentityProfileQueryHandler } from "./application/queries/get-identity-profile.query";
import { GetIdentityAccessQueryHandler } from "./application/queries/get-identity-access.query";
import { RegisterTelegramIdentityCommandHandler } from "./application/commands/register-telegram-identity.command";
import { IDENTITY_REPOSITORY } from "./application/ports/identity-repository.port";
import { PostgresIdentityRepository } from "./persistence/postgres/postgres-identity.repository";
import { RedisIdentityRepository } from "./persistence/redis/redis-identity.repository";
import { AppConfigService } from "../../../shared/config/app-config.service";

@Module({
	imports: [],
	providers: [
		RedisIdentityRepository,
		PostgresIdentityRepository,
		{
			provide: IDENTITY_REPOSITORY,
			inject: [AppConfigService, RedisIdentityRepository, PostgresIdentityRepository],
			useFactory: (
				config: AppConfigService,
				redisRepository: RedisIdentityRepository,
				postgresRepository: PostgresIdentityRepository,
			) => (config.primaryDb === "postgres" ? postgresRepository : redisRepository),
		},
		RegisterTelegramIdentityCommandHandler,
		GetIdentityProfileQueryHandler,
		GetIdentityAccessQueryHandler,
	],
	exports: [
		IDENTITY_REPOSITORY,
		RegisterTelegramIdentityCommandHandler,
		GetIdentityProfileQueryHandler,
		GetIdentityAccessQueryHandler,
	],
})
export class IdentityModule {}

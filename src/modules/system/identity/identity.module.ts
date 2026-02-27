import { Module } from "@nestjs/common";

import { GetUserProfileQueryHandler } from "./application/queries/get-user-profile.query";
import { RegisterTelegramUserCommandHandler } from "./application/commands/register-telegram-user.command";
import { USER_REPOSITORY } from "./application/ports/user-repository.port";
import { PostgresUserRepository } from "./persistence/postgres/postgres-user.repository";
import { RedisUserRepository } from "./persistence/redis/redis-user.repository";
import { AppConfigService } from "../../../shared/config/app-config.service";

@Module({
	imports: [],
	providers: [
		RedisUserRepository,
		PostgresUserRepository,
		{
			provide: USER_REPOSITORY,
			inject: [AppConfigService, RedisUserRepository, PostgresUserRepository],
			useFactory: (config: AppConfigService, redisRepository: RedisUserRepository, postgresRepository: PostgresUserRepository) =>
				config.primaryDb === "postgres" ? postgresRepository : redisRepository,
		},
		RegisterTelegramUserCommandHandler,
		GetUserProfileQueryHandler,
	],
	exports: [USER_REPOSITORY, RegisterTelegramUserCommandHandler, GetUserProfileQueryHandler],
})
export class IdentityModule {}

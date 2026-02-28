import { Module } from "@nestjs/common";

import { BroadcastModule } from "./modules/system/broadcast/broadcast.module";
import { IdentityModule } from "./modules/system/identity/identity.module";
import { TelegramModule } from "./modules/system/telegram/telegram.module";
import { NoopJobDispatcherService } from "./shared/adapters/jobs/noop-job-dispatcher.service";
import { GlobalExceptionFilter } from "./shared/adapters/http/global-exception.filter";
import { HttpLoggingInterceptor } from "./shared/adapters/http/http-logging.interceptor";
import { PinoLoggerService } from "./shared/adapters/logger/pino-logger.service";
import { JOB_DISPATCHER } from "./shared/application/ports/job-dispatcher.port";
import { AppConfigModule } from "./shared/config/app-config.module";
import { HealthModule } from "./shared/health/health.module";
import { SharedModule } from "./shared/shared.module";

@Module({
	imports: [AppConfigModule, SharedModule, HealthModule, IdentityModule, TelegramModule, BroadcastModule],
	providers: [
		PinoLoggerService,
		GlobalExceptionFilter,
		HttpLoggingInterceptor,
		NoopJobDispatcherService,
		{
			provide: JOB_DISPATCHER,
			useExisting: NoopJobDispatcherService,
		},
	],
})
export class AppModule {}

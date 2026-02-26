import { Module } from "@nestjs/common";

import { JOB_DISPATCHER } from "./common/jobs/job-dispatcher.port";
import { NoopJobDispatcherService } from "./common/jobs/noop-job-dispatcher.service";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { HttpLoggingInterceptor } from "./common/interceptors/http-logging.interceptor";
import { PinoLoggerService } from "./common/logger/pino-logger.service";
import { CoreConfigModule } from "./modules/config/core-config.module";
import { HealthModule } from "./modules/health/health.module";
import { TelegramModule } from "./modules/telegram/telegram.module";

@Module({
	imports: [CoreConfigModule, HealthModule, TelegramModule],
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

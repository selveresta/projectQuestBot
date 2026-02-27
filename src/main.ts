import "reflect-metadata";

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./shared/adapters/http/global-exception.filter";
import { HttpLoggingInterceptor } from "./shared/adapters/http/http-logging.interceptor";
import { PinoLoggerService } from "./shared/adapters/logger/pino-logger.service";
import { AppConfigService } from "./shared/config/app-config.service";

async function bootstrap(): Promise<void> {
	const app = await NestFactory.create(AppModule, { bufferLogs: true });
	const logger = app.get(PinoLoggerService);
	const config = app.get(AppConfigService);

	app.useLogger(logger);
	app.useGlobalFilters(app.get(GlobalExceptionFilter));
	app.useGlobalInterceptors(app.get(HttpLoggingInterceptor));
	app.enableShutdownHooks();

	await app.listen(config.httpPort, "0.0.0.0");
	logger.log(`HTTP server started on port ${config.httpPort} in ${config.nodeEnv} mode`);
}

void bootstrap().catch((error: unknown) => {
	// eslint-disable-next-line no-console
	console.error("Fatal startup error", error);
	process.exit(1);
});

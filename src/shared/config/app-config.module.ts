import { Global, Module } from "@nestjs/common";

import { PinoLoggerService } from "../adapters/logger/pino-logger.service";
import { AppConfigService } from "./app-config.service";

@Global()
@Module({
	providers: [AppConfigService, PinoLoggerService],
	exports: [AppConfigService, PinoLoggerService],
})
export class AppConfigModule {}

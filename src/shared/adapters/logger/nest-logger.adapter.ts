import { Injectable } from "@nestjs/common";

import type { LoggerPort } from "../../application/ports/logger.port";
import { PinoLoggerService } from "./pino-logger.service";

@Injectable()
export class NestLoggerAdapter implements LoggerPort {
	constructor(private readonly logger: PinoLoggerService) {}

	debug(message: string, context?: Record<string, unknown>): void {
		this.logger.instance.debug(context ?? {}, message);
	}

	info(message: string, context?: Record<string, unknown>): void {
		this.logger.instance.info(context ?? {}, message);
	}

	warn(message: string, context?: Record<string, unknown>): void {
		this.logger.instance.warn(context ?? {}, message);
	}

	error(message: string, context?: Record<string, unknown>): void {
		this.logger.instance.error(context ?? {}, message);
	}
}

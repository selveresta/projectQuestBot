import { Injectable, LoggerService } from "@nestjs/common";
import pino, { type Logger } from "pino";

import { AppConfigService } from "../../config/app-config.service";

@Injectable()
export class PinoLoggerService implements LoggerService {
	private readonly logger: Logger;

	constructor(config: AppConfigService) {
		this.logger = pino({
			level: config.logLevel,
			timestamp: pino.stdTimeFunctions.isoTime,
			base: undefined,
		});
	}

	get instance(): Logger {
		return this.logger;
	}

	log(message: unknown, ...optionalParams: unknown[]): void {
		this.logger.info(this.buildPayload(optionalParams), this.stringify(message));
	}

	error(message: unknown, ...optionalParams: unknown[]): void {
		const [trace, ...rest] = optionalParams;
		this.logger.error(
			{
				...this.buildPayload(rest),
				trace: typeof trace === "string" ? trace : undefined,
			},
			this.stringify(message),
		);
	}

	warn(message: unknown, ...optionalParams: unknown[]): void {
		this.logger.warn(this.buildPayload(optionalParams), this.stringify(message));
	}

	debug(message: unknown, ...optionalParams: unknown[]): void {
		this.logger.debug(this.buildPayload(optionalParams), this.stringify(message));
	}

	verbose(message: unknown, ...optionalParams: unknown[]): void {
		this.logger.trace(this.buildPayload(optionalParams), this.stringify(message));
	}

	private stringify(value: unknown): string {
		if (typeof value === "string") {
			return value;
		}

		try {
			return JSON.stringify(value);
		} catch {
			return String(value);
		}
	}

	private buildPayload(optionalParams: readonly unknown[]): Record<string, unknown> {
		if (optionalParams.length === 0) {
			return {};
		}

		return {
			context: optionalParams.map((item) => this.stringify(item)).join(" | "),
		};
	}
}

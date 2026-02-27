import {
	ArgumentsHost,
	Catch,
	ExceptionFilter,
	HttpException,
	HttpStatus,
	Injectable,
} from "@nestjs/common";
import type { Request, Response } from "express";

import { PinoLoggerService } from "../logger/pino-logger.service";

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
	constructor(private readonly logger: PinoLoggerService) {}

	catch(exception: unknown, host: ArgumentsHost): void {
		if (host.getType() !== "http") {
			this.logger.error("Unhandled non-HTTP exception", exception);
			return;
		}

		const http = host.switchToHttp();
		const request = http.getRequest<Request>();
		const response = http.getResponse<Response>();

		const statusCode =
			exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
		const responseBody = this.buildResponseBody(exception, request.url, statusCode);

		this.logger.instance.error(
			{
				statusCode,
				method: request.method,
				path: request.url,
				exception,
			},
			"unhandled_exception"
		);

		response.status(statusCode).json(responseBody);
	}

	private buildResponseBody(
		exception: unknown,
		path: string,
		statusCode: number
	): Record<string, unknown> {
		if (exception instanceof HttpException) {
			const payload = exception.getResponse();
			if (typeof payload === "string") {
				return {
					statusCode,
					message: payload,
					timestamp: new Date().toISOString(),
					path,
				};
			}

			if (typeof payload === "object" && payload !== null) {
				return {
					statusCode,
					timestamp: new Date().toISOString(),
					path,
					...(payload as Record<string, unknown>),
				};
			}
		}

		return {
			statusCode,
			message: "Internal server error",
			timestamp: new Date().toISOString(),
			path,
		};
	}
}

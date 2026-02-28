import { CallHandler, ExecutionContext, Injectable, type NestInterceptor } from "@nestjs/common";
import type { Request, Response } from "express";
import { Observable, tap } from "rxjs";

import { PinoLoggerService } from "../logger/pino-logger.service";

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
	constructor(private readonly logger: PinoLoggerService) {}

	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		if (context.getType() !== "http") {
			return next.handle();
		}

		const http = context.switchToHttp();
		const request = http.getRequest<Request>();
		const response = http.getResponse<Response>();
		const startedAt = Date.now();

		return next.handle().pipe(
			tap({
				next: () => {
					this.logger.instance.info(
						{
							method: request.method,
							url: request.url,
							statusCode: response.statusCode,
							durationMs: Date.now() - startedAt,
						},
						"http_request",
					);
				},
				error: (error: unknown) => {
					this.logger.instance.error(
						{
							method: request.method,
							url: request.url,
							statusCode: response.statusCode,
							durationMs: Date.now() - startedAt,
							error,
						},
						"http_request_failed",
					);
				},
			}),
		);
	}
}

import { Injectable } from "@nestjs/common";

import type { RateLimiterInput, RateLimiterPort } from "../application/ports/rate-limiter.port";

@Injectable()
export class NoopRateLimiterService implements RateLimiterPort {
	async allow(_input: RateLimiterInput): Promise<boolean> {
		return true;
	}
}

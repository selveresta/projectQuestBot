export const RATE_LIMITER_PORT = Symbol("RATE_LIMITER_PORT");

export interface RateLimiterConsumeInput {
	key: string;
	points: number;
	durationSeconds: number;
}

export interface RateLimitDecision {
	allowed: boolean;
	remaining: number;
	resetAtEpochSeconds: number;
}

export interface RateLimiterPort {
	consume(input: RateLimiterConsumeInput): Promise<RateLimitDecision>;
}

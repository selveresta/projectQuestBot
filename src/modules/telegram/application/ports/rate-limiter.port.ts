export interface RateLimiterInput {
	userId?: number;
	chatId?: number;
}

export interface RateLimiterPort {
	allow(input: RateLimiterInput): Promise<boolean>;
}

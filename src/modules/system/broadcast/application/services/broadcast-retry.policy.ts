export interface BroadcastRetryPolicyInput {
	attempt: number;
	baseDelayMs: number;
	maxDelayMs: number;
	retryAfterSeconds?: number;
}

export function computeBroadcastRetryDelay(input: BroadcastRetryPolicyInput): number {
	if (input.retryAfterSeconds && input.retryAfterSeconds > 0) {
		return input.retryAfterSeconds * 1000;
	}

	const exponent = Math.max(0, input.attempt - 1);
	const calculated = input.baseDelayMs * 2 ** exponent;
	return Math.min(input.maxDelayMs, calculated);
}

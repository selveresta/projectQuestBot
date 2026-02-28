import assert from "node:assert/strict";
import test from "node:test";

import { computeBroadcastRetryDelay } from "../../../src/modules/system/broadcast/application/services/broadcast-retry.policy";

test("computeBroadcastRetryDelay uses exponential backoff with cap", () => {
	assert.equal(
		computeBroadcastRetryDelay({
			attempt: 1,
			baseDelayMs: 1000,
			maxDelayMs: 30000,
		}),
		1000,
	);
	assert.equal(
		computeBroadcastRetryDelay({
			attempt: 3,
			baseDelayMs: 1000,
			maxDelayMs: 30000,
		}),
		4000,
	);
	assert.equal(
		computeBroadcastRetryDelay({
			attempt: 10,
			baseDelayMs: 1000,
			maxDelayMs: 30000,
		}),
		30000,
	);
});

test("computeBroadcastRetryDelay prioritizes Telegram retry_after", () => {
	assert.equal(
		computeBroadcastRetryDelay({
			attempt: 2,
			baseDelayMs: 1000,
			maxDelayMs: 30000,
			retryAfterSeconds: 7,
		}),
		7000,
	);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
	ProcessBroadcastChunkCommand,
	ProcessBroadcastChunkCommandHandler,
} from "../../../src/modules/system/broadcast/application/commands/process-broadcast-chunk.command";
import type { BroadcastCampaignRepositoryPort } from "../../../src/modules/system/broadcast/application/ports/broadcast-campaign-repository.port";
import type { BroadcastMessageSenderPort } from "../../../src/modules/system/broadcast/application/ports/broadcast-message-sender.port";
import type {
	BroadcastChunkJob,
	BroadcastDlqJob,
	BroadcastQueuePort,
	BroadcastQueueStats,
} from "../../../src/modules/system/broadcast/application/ports/broadcast-queue.port";
import {
	BroadcastCampaignEntity,
	type BroadcastCampaignStatus,
} from "../../../src/modules/system/broadcast/domain/entities/broadcast-campaign.entity";
import { toBroadcastCampaignId } from "../../../src/modules/system/broadcast/domain/value-objects/broadcast-campaign-id";
import type {
	IdentityCursorPage,
	IdentityCursorPageInput,
	IdentityRepositoryPort,
} from "../../../src/modules/system/identity/application/ports/identity-repository.port";
import { IdentityEntity } from "../../../src/modules/system/identity/domain/entities/identity.entity";
import { toIdentityId } from "../../../src/modules/system/identity/domain/value-objects/identity-id";
import { toTelegramIdentityId } from "../../../src/modules/system/identity/domain/value-objects/telegram-identity-id";
import type { ClockPort } from "../../../src/shared/application/ports/clock.port";
import type { IdempotencyKeyPort } from "../../../src/shared/application/ports/idempotency-key.port";
import type { LoggerPort } from "../../../src/shared/application/ports/logger.port";
import type { RateLimiterConsumeInput, RateLimiterPort } from "../../../src/shared/application/ports/rate-limiter.port";
import type { AppConfigService } from "../../../src/shared/config/app-config.service";

class InMemoryCampaignRepository implements BroadcastCampaignRepositoryPort {
	private readonly campaigns = new Map<string, BroadcastCampaignEntity>();

	seed(campaign: BroadcastCampaignEntity): void {
		this.campaigns.set(campaign.id, campaign);
	}

	async getById(id: ReturnType<typeof toBroadcastCampaignId>): Promise<BroadcastCampaignEntity | null> {
		return this.campaigns.get(id) ?? null;
	}

	async save(campaign: BroadcastCampaignEntity): Promise<void> {
		this.campaigns.set(campaign.id, campaign);
	}

	async listByStatuses(
		_statuses: readonly BroadcastCampaignStatus[],
		_limit: number,
	): Promise<BroadcastCampaignEntity[]> {
		return [];
	}

	async listRecent(_limit: number): Promise<BroadcastCampaignEntity[]> {
		return [];
	}
}

class SinglePageIdentityRepository implements IdentityRepositoryPort {
	constructor(private readonly identities: IdentityEntity[]) {}

	async getById(_id: ReturnType<typeof toIdentityId>): Promise<IdentityEntity | null> {
		return null;
	}

	async findByTelegramId(_telegramId: ReturnType<typeof toTelegramIdentityId>): Promise<IdentityEntity | null> {
		return null;
	}

	async listByCursor(_input: IdentityCursorPageInput): Promise<IdentityCursorPage> {
		return {
			items: this.identities,
			nextCursor: undefined,
		};
	}

	async countByUsernamePrefix(_usernamePrefix?: string): Promise<number> {
		return this.identities.length;
	}

	async save(_identity: IdentityEntity): Promise<void> {}

	async delete(_id: ReturnType<typeof toIdentityId>): Promise<void> {}

	async listByIds(_ids: readonly ReturnType<typeof toIdentityId>[]): Promise<IdentityEntity[]> {
		return [];
	}
}

class RecordingQueue implements BroadcastQueuePort {
	published: Array<{ campaignId: string; attempt: number; delayMs?: number }> = [];

	async publishChunk(job: BroadcastChunkJob, delayMs?: number): Promise<void> {
		this.published.push({
			campaignId: job.campaignId,
			attempt: job.attempt,
			delayMs,
		});
	}

	async publishDlq(_job: BroadcastDlqJob): Promise<void> {}

	async startChunkConsumer(_handler: (job: BroadcastChunkJob) => Promise<void>): Promise<void> {}

	async stopChunkConsumer(): Promise<void> {}

	async getQueueStats(): Promise<BroadcastQueueStats> {
		return { chunkReady: 0, retryReady: 0, dlqReady: 0 };
	}

	async requeueDlq(_limit: number): Promise<number> {
		return 0;
	}

	async discardDlq(_limit: number): Promise<number> {
		return 0;
	}
}

class RetryableSender implements BroadcastMessageSenderPort {
	attempts = 0;

	async sendText(_chatId: number, _text: string) {
		this.attempts += 1;
		return {
			ok: false as const,
			failure: {
				classification: "rate_limit" as const,
				errorCode: "telegram_429",
				description: "Too Many Requests: retry after 1",
				retryAfterSeconds: 1,
			},
		};
	}
}

class InMemoryIdempotency implements IdempotencyKeyPort {
	readonly acquiredKeys: string[] = [];
	readonly releasedKeys: string[] = [];

	async acquire(key: string, _ttlSeconds: number): Promise<boolean> {
		this.acquiredKeys.push(key);
		return true;
	}

	async release(key: string): Promise<void> {
		this.releasedKeys.push(key);
	}
}

class AllowAllRateLimiter implements RateLimiterPort {
	async consume(_input: RateLimiterConsumeInput) {
		return {
			allowed: true,
			remaining: 9999,
			resetAtEpochSeconds: Math.floor(Date.now() / 1000) + 1,
		};
	}
}

class FixedClock implements ClockPort {
	now(): Date {
		return new Date("2026-01-01T00:00:00.000Z");
	}

	nowIso() {
		return "2026-01-01T00:00:00.000Z" as ReturnType<ClockPort["nowIso"]>;
	}
}

class NoopLogger implements LoggerPort {
	debug(): void {}
	info(): void {}
	warn(): void {}
	error(): void {}
}

test("ProcessBroadcastChunkCommandHandler schedules retry and releases idempotency on rate-limit failure", async () => {
	const campaignRepository = new InMemoryCampaignRepository();
	const identity = IdentityEntity.createNew({
		id: toIdentityId("u-1"),
		telegramIdentityId: toTelegramIdentityId(101),
		now: "2026-01-01T00:00:00.000Z" as ReturnType<ClockPort["nowIso"]>,
		identity: { username: "alice" },
	});
	const identityRepository = new SinglePageIdentityRepository([identity]);
	const queue = new RecordingQueue();
	const sender = new RetryableSender();
	const idempotency = new InMemoryIdempotency();
	const rateLimiter = new AllowAllRateLimiter();
	const clock = new FixedClock();
	const logger = new NoopLogger();

	const campaign = BroadcastCampaignEntity.createDraft({
		id: toBroadcastCampaignId("c-1"),
		messageText: "hello",
		now: "2026-01-01T00:00:00.000Z" as ReturnType<ClockPort["nowIso"]>,
	}).start("2026-01-01T00:00:00.000Z" as ReturnType<ClockPort["nowIso"]>, 1);
	campaignRepository.seed(campaign);

	const config = {
		broadcastChunkSize: 100,
		broadcastIdempotencyTtlSeconds: 3600,
		broadcastRetryMaxAttempts: 5,
		broadcastRetryBaseDelayMs: 1000,
		broadcastRetryMaxDelayMs: 30000,
		broadcastGlobalRateLimitPoints: 1000,
		broadcastGlobalRateLimitDurationSeconds: 1,
	} as AppConfigService;

	const handler = new ProcessBroadcastChunkCommandHandler(
		campaignRepository,
		identityRepository,
		queue,
		sender,
		idempotency,
		rateLimiter,
		clock,
		logger,
		config,
	);

	await handler.execute(new ProcessBroadcastChunkCommand("c-1", undefined, 0, "start"));

	assert.equal(sender.attempts, 1);
	assert.equal(idempotency.acquiredKeys.length, 1);
	assert.equal(idempotency.releasedKeys.length, 1);
	assert.equal(queue.published.length, 1);
	assert.equal(queue.published[0].campaignId, "c-1");
	assert.equal(queue.published[0].attempt, 1);
	assert.equal(queue.published[0].delayMs, 1000);

	const persisted = await campaignRepository.getById(toBroadcastCampaignId("c-1"));
	assert.ok(persisted);
	assert.equal(persisted.retryCount, 1);
	assert.equal(persisted.status, "running");
	assert.equal(persisted.processedRecipients, 0);
});

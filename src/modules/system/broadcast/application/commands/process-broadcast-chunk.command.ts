import { Inject, Injectable } from "@nestjs/common";

import {
	BROADCAST_CAMPAIGN_REPOSITORY,
	type BroadcastCampaignRepositoryPort,
} from "../ports/broadcast-campaign-repository.port";
import { BROADCAST_QUEUE_PORT, type BroadcastQueuePort } from "../ports/broadcast-queue.port";
import {
	BROADCAST_MESSAGE_SENDER_PORT,
	type BroadcastMessageSenderPort,
	type BroadcastSendFailure,
} from "../ports/broadcast-message-sender.port";
import { computeBroadcastRetryDelay } from "../services/broadcast-retry.policy";
import {
	IDENTITY_REPOSITORY,
	type IdentityRepositoryPort,
} from "../../../identity/application/ports/identity-repository.port";
import type { BroadcastCampaignEntity } from "../../domain/entities/broadcast-campaign.entity";
import { toBroadcastCampaignId } from "../../domain/value-objects/broadcast-campaign-id";
import { CLOCK_PORT, type ClockPort } from "../../../../../shared/application/ports/clock.port";
import {
	IDEMPOTENCY_KEY_PORT,
	type IdempotencyKeyPort,
} from "../../../../../shared/application/ports/idempotency-key.port";
import { LOGGER_PORT, type LoggerPort } from "../../../../../shared/application/ports/logger.port";
import { RATE_LIMITER_PORT, type RateLimiterPort } from "../../../../../shared/application/ports/rate-limiter.port";
import { AppConfigService } from "../../../../../shared/config/app-config.service";
import { RedisKeys } from "../../../../../shared/persistence/redis/redis-key.schema";

export class ProcessBroadcastChunkCommand {
	constructor(
		readonly campaignIdRaw: string,
		readonly cursor: string | undefined,
		readonly attempt: number,
		readonly trigger: string,
	) {}
}

@Injectable()
export class ProcessBroadcastChunkCommandHandler {
	constructor(
		@Inject(BROADCAST_CAMPAIGN_REPOSITORY)
		private readonly campaignRepository: BroadcastCampaignRepositoryPort,
		@Inject(IDENTITY_REPOSITORY)
		private readonly identityRepository: IdentityRepositoryPort,
		@Inject(BROADCAST_QUEUE_PORT)
		private readonly queue: BroadcastQueuePort,
		@Inject(BROADCAST_MESSAGE_SENDER_PORT)
		private readonly messageSender: BroadcastMessageSenderPort,
		@Inject(IDEMPOTENCY_KEY_PORT)
		private readonly idempotency: IdempotencyKeyPort,
		@Inject(RATE_LIMITER_PORT)
		private readonly rateLimiter: RateLimiterPort,
		@Inject(CLOCK_PORT)
		private readonly clock: ClockPort,
		@Inject(LOGGER_PORT)
		private readonly logger: LoggerPort,
		private readonly config: AppConfigService,
	) {}

	async execute(command: ProcessBroadcastChunkCommand): Promise<void> {
		const campaignId = toBroadcastCampaignId(command.campaignIdRaw);
		const campaign = await this.campaignRepository.getById(campaignId);
		if (!campaign) {
			return;
		}
		if (campaign.status !== "running") {
			return;
		}

		const page = await this.identityRepository.listByCursor({
			cursor: command.cursor ?? campaign.nextIdentityCursor,
			limit: this.config.broadcastChunkSize,
			usernamePrefix: campaign.audienceUsernamePrefix,
		});

		let processedDelta = 0;
		let succeededDelta = 0;
		let failedDelta = 0;
		let transientFailure: BroadcastSendFailure | null = null;

		for (const identity of page.items) {
			await this.waitForGlobalThrottle();

			const dedupeKey = RedisKeys.broadcast.idempotencyRecipient(campaign.id, identity.id);
			const acquired = await this.idempotency.acquire(dedupeKey, this.config.broadcastIdempotencyTtlSeconds);
			if (!acquired) {
				continue;
			}

			const sendResult = await this.messageSender.sendText(identity.telegramIdentityId, campaign.messageText);
			if (sendResult.ok) {
				processedDelta += 1;
				succeededDelta += 1;
				continue;
			}

			if (sendResult.failure.classification === "permanent") {
				processedDelta += 1;
				failedDelta += 1;
				this.logger.warn("broadcast_send_permanent_failure", {
					campaignId: campaign.id,
					recipientId: identity.id,
					attempt: command.attempt,
					errorCode: sendResult.failure.errorCode,
				});
				continue;
			}

			await this.idempotency.release(dedupeKey);
			transientFailure = sendResult.failure;
			this.logger.warn("broadcast_send_retryable_failure", {
				campaignId: campaign.id,
				recipientId: identity.id,
				attempt: command.attempt,
				errorCode: transientFailure.errorCode,
			});
			break;
		}

		const latest = await this.campaignRepository.getById(campaign.id);
		if (!latest) {
			return;
		}

		const updatedWithProgress = latest.advanceProgress(
			{
				processedDelta,
				succeededDelta,
				failedDelta,
				nextIdentityCursor: page.nextCursor,
			},
			this.clock.nowIso(),
		);

		if (transientFailure) {
			await this.handleRetryableFailure(updatedWithProgress, command, transientFailure);
			return;
		}

		await this.campaignRepository.save(updatedWithProgress);
		if (updatedWithProgress.status !== "running") {
			return;
		}

		if (page.nextCursor) {
			await this.queue.publishChunk({
				campaignId: updatedWithProgress.id,
				cursor: page.nextCursor,
				attempt: 0,
				trigger: "next",
			});
			return;
		}

		const completed = updatedWithProgress.complete(this.clock.nowIso());
		await this.campaignRepository.save(completed);
	}

	private async handleRetryableFailure(
		campaign: BroadcastCampaignEntity,
		command: ProcessBroadcastChunkCommand,
		failure: BroadcastSendFailure,
	): Promise<void> {
		const now = this.clock.nowIso();
		const attempt = command.attempt + 1;
		const errorCode = failure.errorCode;
		const errorMessage = failure.description;

		if (attempt >= this.config.broadcastRetryMaxAttempts) {
			const dlqCampaign = campaign.recordDlq(now, errorCode, errorMessage).pause(now);
			await this.campaignRepository.save(dlqCampaign);
			await this.queue.publishDlq({
				campaignId: campaign.id,
				cursor: command.cursor,
				attempt,
				errorCode,
				errorMessage,
				failedAt: now,
			});
			this.logger.error("broadcast_chunk_sent_to_dlq", {
				campaignId: campaign.id,
				attempt,
				errorCode,
			});
			return;
		}

		const delayMs = computeBroadcastRetryDelay({
			attempt,
			baseDelayMs: this.config.broadcastRetryBaseDelayMs,
			maxDelayMs: this.config.broadcastRetryMaxDelayMs,
			retryAfterSeconds: failure.retryAfterSeconds,
		});

		const retryCampaign = campaign.recordRetry(now, errorCode, errorMessage);
		await this.campaignRepository.save(retryCampaign);
		if (retryCampaign.status !== "running") {
			return;
		}

		await this.queue.publishChunk(
			{
				campaignId: retryCampaign.id,
				cursor: command.cursor,
				attempt,
				trigger: "retry",
			},
			delayMs,
		);
		this.logger.warn("broadcast_chunk_retry_scheduled", {
			campaignId: retryCampaign.id,
			attempt,
			errorCode,
			retryDelay: delayMs,
		});
	}

	private async waitForGlobalThrottle(): Promise<void> {
		const key = "rl:broadcast:global";
		while (true) {
			const decision = await this.rateLimiter.consume({
				key,
				points: this.config.broadcastGlobalRateLimitPoints,
				durationSeconds: this.config.broadcastGlobalRateLimitDurationSeconds,
			});
			if (decision.allowed) {
				return;
			}

			const nowEpochSeconds = Math.floor(Date.now() / 1000);
			const waitSeconds = Math.max(1, decision.resetAtEpochSeconds - nowEpochSeconds);
			await sleep(waitSeconds * 1000);
		}
	}
}

async function sleep(ms: number): Promise<void> {
	await new Promise<void>((resolve) => {
		setTimeout(resolve, ms);
	});
}

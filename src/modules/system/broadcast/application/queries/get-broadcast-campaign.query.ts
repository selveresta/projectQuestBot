import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
	BROADCAST_CAMPAIGN_REPOSITORY,
	type BroadcastCampaignRepositoryPort,
} from "../ports/broadcast-campaign-repository.port";
import { BROADCAST_QUEUE_PORT, type BroadcastQueuePort } from "../ports/broadcast-queue.port";
import { toBroadcastCampaignId } from "../../domain/value-objects/broadcast-campaign-id";
import type { BroadcastCampaignEntity } from "../../domain/entities/broadcast-campaign.entity";

export interface BroadcastCampaignView {
	id: string;
	status: string;
	messageText: string;
	audienceUsernamePrefix?: string;
	totalRecipients: number;
	processedRecipients: number;
	succeededRecipients: number;
	failedRecipients: number;
	retryCount: number;
	dlqCount: number;
	nextIdentityCursor?: string;
	lastErrorCode?: string;
	lastErrorMessage?: string;
	createdAt: string;
	updatedAt: string;
	startedAt?: string;
	finishedAt?: string;
	processingRatePerMinute: number;
	queue: {
		chunkReady: number;
		retryReady: number;
		dlqReady: number;
	};
}

export class GetBroadcastCampaignQuery {
	constructor(readonly campaignId: string) {}
}

@Injectable()
export class GetBroadcastCampaignQueryHandler {
	constructor(
		@Inject(BROADCAST_CAMPAIGN_REPOSITORY)
		private readonly campaignRepository: BroadcastCampaignRepositoryPort,
		@Inject(BROADCAST_QUEUE_PORT)
		private readonly queue: BroadcastQueuePort,
	) {}

	async execute(query: GetBroadcastCampaignQuery): Promise<BroadcastCampaignView> {
		const campaign = await this.campaignRepository.getById(toBroadcastCampaignId(query.campaignId));
		if (!campaign) {
			throw new NotFoundException(`Broadcast campaign ${query.campaignId} not found`);
		}

		const queueStats = await this.queue.getQueueStats();
		return mapCampaignToView(campaign, queueStats);
	}
}

export function mapCampaignToView(
	campaign: BroadcastCampaignEntity,
	queue: {
		chunkReady: number;
		retryReady: number;
		dlqReady: number;
	},
): BroadcastCampaignView {
	const startedAt = campaign.startedAt ? new Date(campaign.startedAt).getTime() : null;
	const ratePerMinute =
		startedAt && startedAt > 0
			? Number(((campaign.processedRecipients * 60_000) / Math.max(1, Date.now() - startedAt)).toFixed(2))
			: 0;

	return {
		id: campaign.id,
		status: campaign.status,
		messageText: campaign.messageText,
		audienceUsernamePrefix: campaign.audienceUsernamePrefix,
		totalRecipients: campaign.totalRecipients,
		processedRecipients: campaign.processedRecipients,
		succeededRecipients: campaign.succeededRecipients,
		failedRecipients: campaign.failedRecipients,
		retryCount: campaign.retryCount,
		dlqCount: campaign.dlqCount,
		nextIdentityCursor: campaign.nextIdentityCursor,
		lastErrorCode: campaign.lastErrorCode,
		lastErrorMessage: campaign.lastErrorMessage,
		createdAt: campaign.createdAt,
		updatedAt: campaign.updatedAt,
		startedAt: campaign.startedAt,
		finishedAt: campaign.finishedAt,
		processingRatePerMinute: ratePerMinute,
		queue,
	};
}

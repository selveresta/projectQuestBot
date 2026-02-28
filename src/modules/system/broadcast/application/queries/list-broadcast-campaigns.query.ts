import { Inject, Injectable } from "@nestjs/common";

import {
	BROADCAST_CAMPAIGN_REPOSITORY,
	type BroadcastCampaignRepositoryPort,
} from "../ports/broadcast-campaign-repository.port";
import type { BroadcastCampaignStatus } from "../../domain/entities/broadcast-campaign.entity";
import { mapCampaignToView, type BroadcastCampaignView } from "./get-broadcast-campaign.query";

export class ListBroadcastCampaignsQuery {
	constructor(
		readonly limit = 20,
		readonly statuses?: BroadcastCampaignStatus[],
	) {}
}

@Injectable()
export class ListBroadcastCampaignsQueryHandler {
	constructor(
		@Inject(BROADCAST_CAMPAIGN_REPOSITORY)
		private readonly campaignRepository: BroadcastCampaignRepositoryPort,
	) {}

	async execute(query: ListBroadcastCampaignsQuery): Promise<BroadcastCampaignView[]> {
		const limit = Math.max(1, Math.min(200, query.limit));
		const campaigns = query.statuses?.length
			? await this.campaignRepository.listByStatuses(query.statuses, limit)
			: await this.campaignRepository.listRecent(limit);

		const queue = {
			chunkReady: 0,
			retryReady: 0,
			dlqReady: 0,
		};

		return campaigns.map((campaign) => mapCampaignToView(campaign, queue));
	}
}

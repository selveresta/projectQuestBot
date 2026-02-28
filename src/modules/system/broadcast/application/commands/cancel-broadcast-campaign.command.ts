import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
	BROADCAST_CAMPAIGN_REPOSITORY,
	type BroadcastCampaignRepositoryPort,
} from "../ports/broadcast-campaign-repository.port";
import { toBroadcastCampaignId } from "../../domain/value-objects/broadcast-campaign-id";
import type { BroadcastCampaignEntity } from "../../domain/entities/broadcast-campaign.entity";
import { CLOCK_PORT, type ClockPort } from "../../../../../shared/application/ports/clock.port";

export class CancelBroadcastCampaignCommand {
	constructor(readonly campaignId: string) {}
}

@Injectable()
export class CancelBroadcastCampaignCommandHandler {
	constructor(
		@Inject(BROADCAST_CAMPAIGN_REPOSITORY)
		private readonly campaignRepository: BroadcastCampaignRepositoryPort,
		@Inject(CLOCK_PORT)
		private readonly clock: ClockPort,
	) {}

	async execute(command: CancelBroadcastCampaignCommand): Promise<BroadcastCampaignEntity> {
		const campaignId = toBroadcastCampaignId(command.campaignId);
		const campaign = await this.campaignRepository.getById(campaignId);
		if (!campaign) {
			throw new NotFoundException(`Broadcast campaign ${campaignId} not found`);
		}

		if (campaign.status === "completed" || campaign.status === "canceled") {
			return campaign;
		}

		const canceled = campaign.cancel(this.clock.nowIso());
		await this.campaignRepository.save(canceled);
		return canceled;
	}
}

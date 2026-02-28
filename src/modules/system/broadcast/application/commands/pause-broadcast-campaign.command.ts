import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
	BROADCAST_CAMPAIGN_REPOSITORY,
	type BroadcastCampaignRepositoryPort,
} from "../ports/broadcast-campaign-repository.port";
import { toBroadcastCampaignId } from "../../domain/value-objects/broadcast-campaign-id";
import type { BroadcastCampaignEntity } from "../../domain/entities/broadcast-campaign.entity";
import { CLOCK_PORT, type ClockPort } from "../../../../../shared/application/ports/clock.port";

export class PauseBroadcastCampaignCommand {
	constructor(readonly campaignId: string) {}
}

@Injectable()
export class PauseBroadcastCampaignCommandHandler {
	constructor(
		@Inject(BROADCAST_CAMPAIGN_REPOSITORY)
		private readonly campaignRepository: BroadcastCampaignRepositoryPort,
		@Inject(CLOCK_PORT)
		private readonly clock: ClockPort,
	) {}

	async execute(command: PauseBroadcastCampaignCommand): Promise<BroadcastCampaignEntity> {
		const campaignId = toBroadcastCampaignId(command.campaignId);
		const campaign = await this.campaignRepository.getById(campaignId);
		if (!campaign) {
			throw new NotFoundException(`Broadcast campaign ${campaignId} not found`);
		}
		if (campaign.status !== "running") {
			return campaign;
		}

		const paused = campaign.pause(this.clock.nowIso());
		await this.campaignRepository.save(paused);
		return paused;
	}
}

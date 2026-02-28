import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
	BROADCAST_CAMPAIGN_REPOSITORY,
	type BroadcastCampaignRepositoryPort,
} from "../ports/broadcast-campaign-repository.port";
import { BROADCAST_QUEUE_PORT, type BroadcastQueuePort } from "../ports/broadcast-queue.port";
import {
	IDENTITY_REPOSITORY,
	type IdentityRepositoryPort,
} from "../../../identity/application/ports/identity-repository.port";
import { toBroadcastCampaignId } from "../../domain/value-objects/broadcast-campaign-id";
import type { BroadcastCampaignEntity } from "../../domain/entities/broadcast-campaign.entity";
import { CLOCK_PORT, type ClockPort } from "../../../../../shared/application/ports/clock.port";

export class StartBroadcastCampaignCommand {
	constructor(readonly campaignId: string) {}
}

@Injectable()
export class StartBroadcastCampaignCommandHandler {
	constructor(
		@Inject(BROADCAST_CAMPAIGN_REPOSITORY)
		private readonly campaignRepository: BroadcastCampaignRepositoryPort,
		@Inject(IDENTITY_REPOSITORY)
		private readonly identityRepository: IdentityRepositoryPort,
		@Inject(BROADCAST_QUEUE_PORT)
		private readonly queue: BroadcastQueuePort,
		@Inject(CLOCK_PORT)
		private readonly clock: ClockPort,
	) {}

	async execute(command: StartBroadcastCampaignCommand): Promise<BroadcastCampaignEntity> {
		const campaignId = toBroadcastCampaignId(command.campaignId);
		const campaign = await this.campaignRepository.getById(campaignId);
		if (!campaign) {
			throw new NotFoundException(`Broadcast campaign ${campaignId} not found`);
		}

		if (campaign.status === "running") {
			return campaign;
		}
		if (campaign.status === "completed" || campaign.status === "canceled") {
			throw new Error(`Campaign ${campaign.id} cannot be started from status ${campaign.status}`);
		}

		const totalRecipients = await this.identityRepository.countByUsernamePrefix(campaign.audienceUsernamePrefix);
		const started = campaign.start(this.clock.nowIso(), totalRecipients);
		await this.campaignRepository.save(started);

		await this.queue.publishChunk({
			campaignId: started.id,
			cursor: started.nextIdentityCursor,
			attempt: 0,
			trigger: "start",
		});
		return started;
	}
}

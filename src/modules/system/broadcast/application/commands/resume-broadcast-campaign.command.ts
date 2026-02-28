import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
	BROADCAST_CAMPAIGN_REPOSITORY,
	type BroadcastCampaignRepositoryPort,
} from "../ports/broadcast-campaign-repository.port";
import { BROADCAST_QUEUE_PORT, type BroadcastQueuePort } from "../ports/broadcast-queue.port";
import { toBroadcastCampaignId } from "../../domain/value-objects/broadcast-campaign-id";
import type { BroadcastCampaignEntity } from "../../domain/entities/broadcast-campaign.entity";
import { CLOCK_PORT, type ClockPort } from "../../../../../shared/application/ports/clock.port";

export class ResumeBroadcastCampaignCommand {
	constructor(readonly campaignId: string) {}
}

@Injectable()
export class ResumeBroadcastCampaignCommandHandler {
	constructor(
		@Inject(BROADCAST_CAMPAIGN_REPOSITORY)
		private readonly campaignRepository: BroadcastCampaignRepositoryPort,
		@Inject(BROADCAST_QUEUE_PORT)
		private readonly queue: BroadcastQueuePort,
		@Inject(CLOCK_PORT)
		private readonly clock: ClockPort,
	) {}

	async execute(command: ResumeBroadcastCampaignCommand): Promise<BroadcastCampaignEntity> {
		const campaignId = toBroadcastCampaignId(command.campaignId);
		const campaign = await this.campaignRepository.getById(campaignId);
		if (!campaign) {
			throw new NotFoundException(`Broadcast campaign ${campaignId} not found`);
		}
		if (campaign.status !== "paused") {
			return campaign;
		}

		const resumed = campaign.resume(this.clock.nowIso());
		await this.campaignRepository.save(resumed);
		await this.queue.publishChunk({
			campaignId: resumed.id,
			cursor: resumed.nextIdentityCursor,
			attempt: 0,
			trigger: "resume",
		});
		return resumed;
	}
}

import { Inject, Injectable } from "@nestjs/common";

import {
	BROADCAST_CAMPAIGN_REPOSITORY,
	type BroadcastCampaignRepositoryPort,
} from "../ports/broadcast-campaign-repository.port";
import { BroadcastCampaignEntity } from "../../domain/entities/broadcast-campaign.entity";
import { toBroadcastCampaignId } from "../../domain/value-objects/broadcast-campaign-id";
import { CLOCK_PORT, type ClockPort } from "../../../../../shared/application/ports/clock.port";
import { ID_GENERATOR_PORT, type IdGeneratorPort } from "../../../../../shared/application/ports/id-generator.port";

export class CreateBroadcastCampaignCommand {
	constructor(
		readonly messageText: string,
		readonly audienceUsernamePrefix?: string,
	) {}
}

@Injectable()
export class CreateBroadcastCampaignCommandHandler {
	constructor(
		@Inject(BROADCAST_CAMPAIGN_REPOSITORY)
		private readonly campaignRepository: BroadcastCampaignRepositoryPort,
		@Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
		@Inject(CLOCK_PORT) private readonly clock: ClockPort,
	) {}

	async execute(command: CreateBroadcastCampaignCommand): Promise<BroadcastCampaignEntity> {
		const now = this.clock.nowIso();
		const campaign = BroadcastCampaignEntity.createDraft({
			id: toBroadcastCampaignId(this.idGenerator.next()),
			messageText: command.messageText,
			audienceUsernamePrefix: command.audienceUsernamePrefix,
			now,
		});

		await this.campaignRepository.save(campaign);
		return campaign;
	}
}

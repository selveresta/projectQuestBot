import type { BroadcastCampaignEntity, BroadcastCampaignStatus } from "../../domain/entities/broadcast-campaign.entity";
import type { BroadcastCampaignId } from "../../domain/value-objects/broadcast-campaign-id";

export { BROADCAST_CAMPAIGN_REPOSITORY } from "../../../../../shared/di/tokens";

export interface BroadcastCampaignRepositoryPort {
	getById(id: BroadcastCampaignId): Promise<BroadcastCampaignEntity | null>;
	save(campaign: BroadcastCampaignEntity): Promise<void>;
	listByStatuses(statuses: readonly BroadcastCampaignStatus[], limit: number): Promise<BroadcastCampaignEntity[]>;
	listRecent(limit: number): Promise<BroadcastCampaignEntity[]>;
}

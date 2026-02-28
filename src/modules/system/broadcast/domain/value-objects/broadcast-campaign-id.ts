import type { Brand } from "../../../../../shared/domain/brand";

export type BroadcastCampaignId = Brand<string, "BroadcastCampaignId">;

export function toBroadcastCampaignId(value: string): BroadcastCampaignId {
	const normalized = value.trim();
	if (!normalized) {
		throw new Error("BroadcastCampaignId must be non-empty");
	}
	return normalized as BroadcastCampaignId;
}

import assert from "node:assert/strict";
import test from "node:test";

import {
	CreateBroadcastCampaignCommand,
	CreateBroadcastCampaignCommandHandler,
} from "../../../src/modules/system/broadcast/application/commands/create-broadcast-campaign.command";
import type { BroadcastCampaignRepositoryPort } from "../../../src/modules/system/broadcast/application/ports/broadcast-campaign-repository.port";
import type { BroadcastCampaignStatus } from "../../../src/modules/system/broadcast/domain/entities/broadcast-campaign.entity";
import type { BroadcastCampaignEntity } from "../../../src/modules/system/broadcast/domain/entities/broadcast-campaign.entity";
import type { BroadcastCampaignId } from "../../../src/modules/system/broadcast/domain/value-objects/broadcast-campaign-id";
import type { ClockPort } from "../../../src/shared/application/ports/clock.port";
import type { IdGeneratorPort } from "../../../src/shared/application/ports/id-generator.port";

class InMemoryBroadcastCampaignRepository implements BroadcastCampaignRepositoryPort {
	private readonly campaigns = new Map<string, BroadcastCampaignEntity>();

	async getById(id: BroadcastCampaignId): Promise<BroadcastCampaignEntity | null> {
		return this.campaigns.get(id) ?? null;
	}

	async save(campaign: BroadcastCampaignEntity): Promise<void> {
		this.campaigns.set(campaign.id, campaign);
	}

	async listByStatuses(
		_statuses: readonly BroadcastCampaignStatus[],
		_limit: number,
	): Promise<BroadcastCampaignEntity[]> {
		return [];
	}

	async listRecent(_limit: number): Promise<BroadcastCampaignEntity[]> {
		return [];
	}
}

class FixedClock implements ClockPort {
	now(): Date {
		return new Date("2026-01-01T00:00:00.000Z");
	}

	nowIso() {
		return "2026-01-01T00:00:00.000Z" as ReturnType<ClockPort["nowIso"]>;
	}
}

class FixedIdGenerator implements IdGeneratorPort {
	next(): string {
		return "campaign-1";
	}
}

test("CreateBroadcastCampaignCommandHandler creates draft campaign", async () => {
	const repository = new InMemoryBroadcastCampaignRepository();
	const handler = new CreateBroadcastCampaignCommandHandler(repository, new FixedIdGenerator(), new FixedClock());

	const campaign = await handler.execute(new CreateBroadcastCampaignCommand("hello world", "alice"));
	assert.equal(campaign.id, "campaign-1");
	assert.equal(campaign.status, "draft");
	assert.equal(campaign.messageText, "hello world");
	assert.equal(campaign.audienceUsernamePrefix, "alice");

	const persisted = await repository.getById(campaign.id);
	assert.ok(persisted);
	assert.equal(persisted.status, "draft");
});

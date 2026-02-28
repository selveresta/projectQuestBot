import { Inject, Injectable } from "@nestjs/common";

import type { BroadcastCampaignRepositoryPort } from "../../application/ports/broadcast-campaign-repository.port";
import type { BroadcastCampaignEntity, BroadcastCampaignStatus } from "../../domain/entities/broadcast-campaign.entity";
import type { BroadcastCampaignId } from "../../domain/value-objects/broadcast-campaign-id";
import { broadcastCampaignToRedisHash, redisHashToBroadcastCampaign } from "../mappers/broadcast-campaign.mapper";
import { REDIS_CLIENT } from "../../../../../shared/persistence/redis/redis.constants";
import { RedisKeys } from "../../../../../shared/persistence/redis/redis-key.schema";
import type { RedisClient } from "../../../../../shared/persistence/redis/redis.provider";

@Injectable()
export class RedisBroadcastCampaignRepository implements BroadcastCampaignRepositoryPort {
	constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}

	async getById(id: BroadcastCampaignId): Promise<BroadcastCampaignEntity | null> {
		const hash = await this.redis.hGetAll(RedisKeys.broadcast.campaign(id));
		if (!hash.id) {
			return null;
		}
		return redisHashToBroadcastCampaign(hash);
	}

	async save(campaign: BroadcastCampaignEntity): Promise<void> {
		const hash = broadcastCampaignToRedisHash(campaign);
		const entityKey = RedisKeys.broadcast.campaign(campaign.id);
		const newStatusSet = RedisKeys.broadcast.statusIndex(campaign.status);
		const existingStatus = await this.redis.hGet(entityKey, "status");
		const score = Date.parse(campaign.createdAt);

		const transaction = this.redis
			.multi()
			.hSet(entityKey, hash as Record<string, string>)
			.sAdd(newStatusSet, campaign.id)
			.zAdd(RedisKeys.broadcast.recentIndex, {
				value: campaign.id,
				score: Number.isFinite(score) ? score : Date.now(),
			});

		if (existingStatus && existingStatus !== campaign.status) {
			transaction.sRem(RedisKeys.broadcast.statusIndex(existingStatus), campaign.id);
		}
		await transaction.exec();
	}

	async listByStatuses(
		statuses: readonly BroadcastCampaignStatus[],
		limit: number,
	): Promise<BroadcastCampaignEntity[]> {
		const ids = new Set<string>();
		for (const status of statuses) {
			const statusIds = await this.redis.sMembers(RedisKeys.broadcast.statusIndex(status));
			for (const id of statusIds) {
				ids.add(id);
				if (ids.size >= limit) {
					break;
				}
			}
			if (ids.size >= limit) {
				break;
			}
		}

		const result: BroadcastCampaignEntity[] = [];
		for (const id of ids) {
			const campaign = await this.getById(id as BroadcastCampaignId);
			if (campaign) {
				result.push(campaign);
			}
		}
		return result.slice(0, limit);
	}

	async listRecent(limit: number): Promise<BroadcastCampaignEntity[]> {
		const ids = await this.redis.zRange(RedisKeys.broadcast.recentIndex, 0, Math.max(0, limit - 1), {
			REV: true,
		});
		const campaigns: BroadcastCampaignEntity[] = [];
		for (const id of ids) {
			const campaign = await this.getById(id as BroadcastCampaignId);
			if (campaign) {
				campaigns.push(campaign);
			}
		}
		return campaigns;
	}
}

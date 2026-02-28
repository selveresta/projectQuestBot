import { Inject, Injectable, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";

import {
	ProcessBroadcastChunkCommand,
	ProcessBroadcastChunkCommandHandler,
} from "../application/commands/process-broadcast-chunk.command";
import { BROADCAST_QUEUE_PORT, type BroadcastQueuePort } from "../application/ports/broadcast-queue.port";
import {
	BROADCAST_CAMPAIGN_REPOSITORY,
	type BroadcastCampaignRepositoryPort,
} from "../application/ports/broadcast-campaign-repository.port";
import { LOGGER_PORT, type LoggerPort } from "../../../../shared/application/ports/logger.port";
import { AppConfigService } from "../../../../shared/config/app-config.service";

@Injectable()
export class BroadcastWorkerService implements OnModuleInit, OnApplicationShutdown {
	constructor(
		@Inject(BROADCAST_QUEUE_PORT)
		private readonly queue: BroadcastQueuePort,
		@Inject(BROADCAST_CAMPAIGN_REPOSITORY)
		private readonly campaignRepository: BroadcastCampaignRepositoryPort,
		private readonly processChunkCommandHandler: ProcessBroadcastChunkCommandHandler,
		@Inject(LOGGER_PORT)
		private readonly logger: LoggerPort,
		private readonly config: AppConfigService,
	) {}

	async onModuleInit(): Promise<void> {
		await this.queue.startChunkConsumer(async (job) => {
			await this.processChunkCommandHandler.execute(
				new ProcessBroadcastChunkCommand(job.campaignId, job.cursor, job.attempt, job.trigger),
			);
		});
		await this.recoverRunningCampaigns();
	}

	async onApplicationShutdown(): Promise<void> {
		await this.queue.stopChunkConsumer();
	}

	private async recoverRunningCampaigns(): Promise<void> {
		const running = await this.campaignRepository.listByStatuses(["running"], this.config.broadcastRecoveryBatchSize);
		for (const campaign of running) {
			await this.queue.publishChunk({
				campaignId: campaign.id,
				cursor: campaign.nextIdentityCursor,
				attempt: 0,
				trigger: "recovery",
			});
		}

		this.logger.info("broadcast_recovery_completed", {
			runningCampaigns: running.length,
		});
	}
}

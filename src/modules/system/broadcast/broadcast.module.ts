import { Module } from "@nestjs/common";

import { IdentityModule } from "../identity/identity.module";
import { TelegramModule } from "../telegram/telegram.module";
import { BroadcastController } from "./broadcast.controller";
import { CancelBroadcastCampaignCommandHandler } from "./application/commands/cancel-broadcast-campaign.command";
import { CreateBroadcastCampaignCommandHandler } from "./application/commands/create-broadcast-campaign.command";
import { DiscardBroadcastDlqCommandHandler } from "./application/commands/discard-broadcast-dlq.command";
import { PauseBroadcastCampaignCommandHandler } from "./application/commands/pause-broadcast-campaign.command";
import { ProcessBroadcastChunkCommandHandler } from "./application/commands/process-broadcast-chunk.command";
import { RequeueBroadcastDlqCommandHandler } from "./application/commands/requeue-broadcast-dlq.command";
import { ResumeBroadcastCampaignCommandHandler } from "./application/commands/resume-broadcast-campaign.command";
import { StartBroadcastCampaignCommandHandler } from "./application/commands/start-broadcast-campaign.command";
import {
	BROADCAST_CAMPAIGN_REPOSITORY,
	type BroadcastCampaignRepositoryPort,
} from "./application/ports/broadcast-campaign-repository.port";
import { BROADCAST_MESSAGE_SENDER_PORT } from "./application/ports/broadcast-message-sender.port";
import { BROADCAST_QUEUE_PORT } from "./application/ports/broadcast-queue.port";
import { GetBroadcastCampaignQueryHandler } from "./application/queries/get-broadcast-campaign.query";
import { GetBroadcastDlqQueryHandler } from "./application/queries/get-broadcast-dlq.query";
import { ListBroadcastCampaignsQueryHandler } from "./application/queries/list-broadcast-campaigns.query";
import { RabbitMqBroadcastQueueAdapter } from "./adapters/rabbitmq/rabbitmq-broadcast-queue.adapter";
import { TelegramBroadcastMessageSenderAdapter } from "./adapters/telegram/telegram-broadcast-message-sender.adapter";
import { PostgresBroadcastBootstrapService } from "./persistence/postgres/postgres-broadcast-bootstrap.service";
import { PostgresBroadcastCampaignRepository } from "./persistence/postgres/postgres-broadcast-campaign.repository";
import { RedisBroadcastCampaignRepository } from "./persistence/redis/redis-broadcast-campaign.repository";
import { BroadcastWorkerService } from "./workers/broadcast-worker.service";
import { AppConfigService } from "../../../shared/config/app-config.service";

@Module({
	imports: [IdentityModule, TelegramModule],
	controllers: [BroadcastController],
	providers: [
		RedisBroadcastCampaignRepository,
		PostgresBroadcastCampaignRepository,
		PostgresBroadcastBootstrapService,
		RabbitMqBroadcastQueueAdapter,
		TelegramBroadcastMessageSenderAdapter,
		{
			provide: BROADCAST_CAMPAIGN_REPOSITORY,
			inject: [AppConfigService, RedisBroadcastCampaignRepository, PostgresBroadcastCampaignRepository],
			useFactory: (
				config: AppConfigService,
				redisRepository: RedisBroadcastCampaignRepository,
				postgresRepository: PostgresBroadcastCampaignRepository,
			): BroadcastCampaignRepositoryPort => (config.primaryDb === "postgres" ? postgresRepository : redisRepository),
		},
		{
			provide: BROADCAST_QUEUE_PORT,
			useExisting: RabbitMqBroadcastQueueAdapter,
		},
		{
			provide: BROADCAST_MESSAGE_SENDER_PORT,
			useExisting: TelegramBroadcastMessageSenderAdapter,
		},
		CreateBroadcastCampaignCommandHandler,
		StartBroadcastCampaignCommandHandler,
		PauseBroadcastCampaignCommandHandler,
		ResumeBroadcastCampaignCommandHandler,
		CancelBroadcastCampaignCommandHandler,
		ProcessBroadcastChunkCommandHandler,
		RequeueBroadcastDlqCommandHandler,
		DiscardBroadcastDlqCommandHandler,
		GetBroadcastCampaignQueryHandler,
		ListBroadcastCampaignsQueryHandler,
		GetBroadcastDlqQueryHandler,
		BroadcastWorkerService,
	],
	exports: [BROADCAST_CAMPAIGN_REPOSITORY],
})
export class BroadcastModule {}

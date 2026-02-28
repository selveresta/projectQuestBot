import { BadRequestException, Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";

import {
	CancelBroadcastCampaignCommand,
	CancelBroadcastCampaignCommandHandler,
} from "./application/commands/cancel-broadcast-campaign.command";
import {
	CreateBroadcastCampaignCommand,
	CreateBroadcastCampaignCommandHandler,
} from "./application/commands/create-broadcast-campaign.command";
import {
	DiscardBroadcastDlqCommand,
	DiscardBroadcastDlqCommandHandler,
} from "./application/commands/discard-broadcast-dlq.command";
import {
	PauseBroadcastCampaignCommand,
	PauseBroadcastCampaignCommandHandler,
} from "./application/commands/pause-broadcast-campaign.command";
import {
	ResumeBroadcastCampaignCommand,
	ResumeBroadcastCampaignCommandHandler,
} from "./application/commands/resume-broadcast-campaign.command";
import {
	RequeueBroadcastDlqCommand,
	RequeueBroadcastDlqCommandHandler,
} from "./application/commands/requeue-broadcast-dlq.command";
import {
	StartBroadcastCampaignCommand,
	StartBroadcastCampaignCommandHandler,
} from "./application/commands/start-broadcast-campaign.command";
import {
	GetBroadcastCampaignQuery,
	GetBroadcastCampaignQueryHandler,
} from "./application/queries/get-broadcast-campaign.query";
import { GetBroadcastDlqQuery, GetBroadcastDlqQueryHandler } from "./application/queries/get-broadcast-dlq.query";
import {
	ListBroadcastCampaignsQuery,
	ListBroadcastCampaignsQueryHandler,
} from "./application/queries/list-broadcast-campaigns.query";
import type { BroadcastCampaignStatus } from "./domain/entities/broadcast-campaign.entity";

const CreateBroadcastCampaignBodySchema = z.object({
	messageText: z.string().min(1).max(4096),
	audienceUsernamePrefix: z.string().min(1).max(64).optional(),
});

const ListBroadcastCampaignsQuerySchema = z.object({
	limit: z.coerce.number().int().positive().max(200).default(20),
	statuses: z.string().optional(),
});

const RequeueDlqQuerySchema = z.object({
	limit: z.coerce.number().int().positive().max(1000).default(100),
});

@Controller("broadcast")
export class BroadcastController {
	constructor(
		private readonly createCampaignHandler: CreateBroadcastCampaignCommandHandler,
		private readonly startCampaignHandler: StartBroadcastCampaignCommandHandler,
		private readonly pauseCampaignHandler: PauseBroadcastCampaignCommandHandler,
		private readonly resumeCampaignHandler: ResumeBroadcastCampaignCommandHandler,
		private readonly cancelCampaignHandler: CancelBroadcastCampaignCommandHandler,
		private readonly getCampaignHandler: GetBroadcastCampaignQueryHandler,
		private readonly listCampaignsHandler: ListBroadcastCampaignsQueryHandler,
		private readonly getDlqHandler: GetBroadcastDlqQueryHandler,
		private readonly requeueDlqHandler: RequeueBroadcastDlqCommandHandler,
		private readonly discardDlqHandler: DiscardBroadcastDlqCommandHandler,
	) {}

	@Post("campaigns")
	async createCampaign(@Body() payload: unknown): Promise<{ id: string; status: string }> {
		const parsed = CreateBroadcastCampaignBodySchema.safeParse(payload);
		if (!parsed.success) {
			throw new BadRequestException(parsed.error.message);
		}

		const campaign = await this.createCampaignHandler.execute(
			new CreateBroadcastCampaignCommand(parsed.data.messageText, parsed.data.audienceUsernamePrefix),
		);
		return {
			id: campaign.id,
			status: campaign.status,
		};
	}

	@Post("campaigns/:id/start")
	async startCampaign(@Param("id") id: string): Promise<{ id: string; status: string }> {
		const campaign = await this.startCampaignHandler.execute(new StartBroadcastCampaignCommand(id));
		return {
			id: campaign.id,
			status: campaign.status,
		};
	}

	@Post("campaigns/:id/pause")
	async pauseCampaign(@Param("id") id: string): Promise<{ id: string; status: string }> {
		const campaign = await this.pauseCampaignHandler.execute(new PauseBroadcastCampaignCommand(id));
		return {
			id: campaign.id,
			status: campaign.status,
		};
	}

	@Post("campaigns/:id/resume")
	async resumeCampaign(@Param("id") id: string): Promise<{ id: string; status: string }> {
		const campaign = await this.resumeCampaignHandler.execute(new ResumeBroadcastCampaignCommand(id));
		return {
			id: campaign.id,
			status: campaign.status,
		};
	}

	@Post("campaigns/:id/cancel")
	async cancelCampaign(@Param("id") id: string): Promise<{ id: string; status: string }> {
		const campaign = await this.cancelCampaignHandler.execute(new CancelBroadcastCampaignCommand(id));
		return {
			id: campaign.id,
			status: campaign.status,
		};
	}

	@Get("campaigns/:id")
	async getCampaign(@Param("id") id: string) {
		return this.getCampaignHandler.execute(new GetBroadcastCampaignQuery(id));
	}

	@Get("campaigns")
	async listCampaigns(@Query() query: unknown) {
		const parsed = ListBroadcastCampaignsQuerySchema.safeParse(query);
		if (!parsed.success) {
			throw new BadRequestException(parsed.error.message);
		}

		const statuses = parseStatuses(parsed.data.statuses);
		return this.listCampaignsHandler.execute(new ListBroadcastCampaignsQuery(parsed.data.limit, statuses));
	}

	@Get("dlq")
	async getDlqOverview() {
		return this.getDlqHandler.execute(new GetBroadcastDlqQuery());
	}

	@Post("dlq/requeue")
	async requeueDlq(@Query() query: unknown) {
		const parsed = RequeueDlqQuerySchema.safeParse(query);
		if (!parsed.success) {
			throw new BadRequestException(parsed.error.message);
		}
		return this.requeueDlqHandler.execute(new RequeueBroadcastDlqCommand(parsed.data.limit));
	}

	@Post("dlq/discard")
	async discardDlq(@Query() query: unknown) {
		const parsed = RequeueDlqQuerySchema.safeParse(query);
		if (!parsed.success) {
			throw new BadRequestException(parsed.error.message);
		}
		return this.discardDlqHandler.execute(new DiscardBroadcastDlqCommand(parsed.data.limit));
	}
}

function parseStatuses(raw: string | undefined): BroadcastCampaignStatus[] | undefined {
	if (!raw) {
		return undefined;
	}

	const parsed = raw
		.split(",")
		.map((value) => value.trim())
		.filter((value) => value.length > 0) as BroadcastCampaignStatus[];
	return parsed.length === 0 ? undefined : parsed;
}

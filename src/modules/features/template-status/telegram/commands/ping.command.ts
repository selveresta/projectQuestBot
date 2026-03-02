import { Injectable } from "@nestjs/common";

import {
	GetTemplateStatusQuery,
	GetTemplateStatusQueryHandler,
} from "../../application/queries/get-template-status.query";
import type { TelegramBotContext, TelegramCommandHandler } from "../../../../system/telegram/telegram.types";

@Injectable()
export class TemplatePingCommandHandler implements TelegramCommandHandler {
	readonly command = "ping";
	readonly featureFlag = "feature.template-ping";
	readonly requiresIdentity = false;
	readonly description = "Template health snapshot for smoke checks";

	constructor(private readonly getTemplateStatusQueryHandler: GetTemplateStatusQueryHandler) {}

	async execute(ctx: TelegramBotContext): Promise<void> {
		const status = await this.getTemplateStatusQueryHandler.execute(new GetTemplateStatusQuery());
		await ctx.reply(
			[`pong`, `mode: ${status.telegramMode}`, `db: ${status.primaryDb}`, `time: ${status.timestamp}`].join("\n"),
		);
	}
}

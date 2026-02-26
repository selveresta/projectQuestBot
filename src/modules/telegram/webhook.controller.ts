import { BadRequestException, Body, Controller, Headers, HttpCode, NotFoundException, Post, UnauthorizedException } from "@nestjs/common";
import type { Update } from "grammy/types";

import { AppConfigService } from "../config/app-config.service";
import { WebhookUpdateSchema } from "./application/dto/webhook-update.dto";
import { TelegramService } from "./telegram.service";

@Controller("telegram")
export class WebhookController {
	constructor(
		private readonly telegramService: TelegramService,
		private readonly config: AppConfigService,
	) {}

	@Post("webhook")
	@HttpCode(200)
	async handleUpdate(
		@Body() payload: unknown,
		@Headers("x-telegram-bot-api-secret-token") secretToken: string | undefined,
	): Promise<{ ok: true }> {
		if (!this.config.isProduction()) {
			throw new NotFoundException("Webhook route is disabled in development mode");
		}

		if (!secretToken || secretToken !== this.config.telegramWebhookSecret) {
			throw new UnauthorizedException("Invalid Telegram webhook secret token");
		}

		const parsed = WebhookUpdateSchema.safeParse(payload);
		if (!parsed.success) {
			throw new BadRequestException("Invalid Telegram update payload");
		}

		await this.telegramService.handleWebhookUpdate(parsed.data as unknown as Update);
		return { ok: true };
	}
}

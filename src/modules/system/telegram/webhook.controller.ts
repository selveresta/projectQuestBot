import {
	BadRequestException,
	Body,
	Controller,
	Headers,
	HttpCode,
	NotFoundException,
	Post,
	UnauthorizedException,
} from "@nestjs/common";
import { z } from "zod";

import { AppConfigService } from "../../../shared/config/app-config.service";
import { TelegramService } from "./telegram.service";

const TelegramWebhookUpdateSchema = z
	.object({
		update_id: z.number().int().nonnegative(),
	})
	.passthrough();

@Controller("telegram")
export class TelegramWebhookController {
	constructor(
		private readonly telegramService: TelegramService,
		private readonly config: AppConfigService,
	) {}

	@Post("webhook")
	@HttpCode(200)
	async handleWebhook(
		@Body() payload: unknown,
		@Headers("x-telegram-bot-api-secret-token") secret: string | undefined,
	): Promise<{ ok: true }> {
		if (!this.config.isProduction()) {
			throw new NotFoundException("Webhook endpoint is available only in production mode");
		}
		if (!secret || secret !== this.config.telegramWebhookSecret) {
			throw new UnauthorizedException("Invalid Telegram webhook secret token");
		}

		const parsed = TelegramWebhookUpdateSchema.safeParse(payload);
		if (!parsed.success) {
			throw new BadRequestException("Invalid Telegram update payload");
		}

		await this.telegramService.handleWebhookUpdate(parsed.data);
		return { ok: true };
	}
}

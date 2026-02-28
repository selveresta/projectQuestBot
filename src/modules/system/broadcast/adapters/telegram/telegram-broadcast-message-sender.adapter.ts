import { Injectable } from "@nestjs/common";
import { GrammyError, HttpError } from "grammy";

import type {
	BroadcastMessageSenderPort,
	BroadcastSendFailure,
	BroadcastSendResult,
} from "../../application/ports/broadcast-message-sender.port";
import { TelegramService } from "../../../telegram/telegram.service";

@Injectable()
export class TelegramBroadcastMessageSenderAdapter implements BroadcastMessageSenderPort {
	constructor(private readonly telegramService: TelegramService) {}

	async sendText(chatId: number, text: string): Promise<BroadcastSendResult> {
		try {
			await this.telegramService.sendTextMessage(chatId, text);
			return { ok: true };
		} catch (error) {
			return {
				ok: false,
				failure: this.classifyError(error),
			};
		}
	}

	private classifyError(error: unknown): BroadcastSendFailure {
		if (error instanceof GrammyError) {
			const description = error.description || "Telegram API error";
			const normalized = description.toLowerCase();
			const retryAfterSeconds = extractRetryAfterSeconds(description);

			if (error.error_code === 429 || retryAfterSeconds !== undefined) {
				return {
					classification: "rate_limit",
					errorCode: "telegram_429",
					description,
					retryAfterSeconds,
				};
			}

			if (
				normalized.includes("bot was blocked") ||
				normalized.includes("user is deactivated") ||
				normalized.includes("chat not found") ||
				normalized.includes("forbidden")
			) {
				return {
					classification: "permanent",
					errorCode: `telegram_${error.error_code}`,
					description,
				};
			}

			return {
				classification: "transient",
				errorCode: `telegram_${error.error_code}`,
				description,
			};
		}

		if (error instanceof HttpError) {
			return {
				classification: "transient",
				errorCode: "telegram_http_error",
				description: error.message,
			};
		}

		if (error instanceof Error) {
			return {
				classification: "transient",
				errorCode: "telegram_unknown_error",
				description: error.message,
			};
		}

		return {
			classification: "transient",
			errorCode: "telegram_unknown_error",
			description: String(error),
		};
	}
}

function extractRetryAfterSeconds(description: string): number | undefined {
	const match = description.match(/retry after (\d+)/i);
	if (!match) {
		return undefined;
	}
	return Number.parseInt(match[1], 10);
}

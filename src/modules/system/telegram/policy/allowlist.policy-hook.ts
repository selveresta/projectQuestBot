import { Injectable } from "@nestjs/common";

import { AppConfigService } from "../../../../shared/config/app-config.service";
import type { TelegramPolicyDecision, TelegramPolicyHook, TelegramPolicyHookContext } from "../telegram.types";

@Injectable()
export class AllowlistPolicyHook implements TelegramPolicyHook {
	readonly name = "allowlist";

	constructor(private readonly config: AppConfigService) {}

	async evaluate(input: TelegramPolicyHookContext): Promise<TelegramPolicyDecision> {
		const from = input.ctx.from;
		if (!from) {
			return {
				allowed: false,
				reason: "telegram identity is missing in the update",
				replyMessage: "I can process commands only for Telegram users.",
			};
		}

		const allowlist = this.config.telegramAllowlistIds;
		if (allowlist.length === 0) {
			return { allowed: true };
		}

		if (allowlist.includes(from.id) || this.config.telegramAdminIds.includes(from.id)) {
			return { allowed: true };
		}

		return {
			allowed: false,
			reason: "telegram user is not present in allowlist",
			replyMessage: "Your Telegram account is not allowlisted for this bot.",
		};
	}
}

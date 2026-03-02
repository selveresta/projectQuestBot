import { Injectable } from "@nestjs/common";

import { AppConfigService } from "../../../../shared/config/app-config.service";
import type { TelegramPolicyDecision, TelegramPolicyHook, TelegramPolicyHookContext } from "../telegram.types";

@Injectable()
export class AdminAccessPolicyHook implements TelegramPolicyHook {
	readonly name = "admin_access";

	constructor(private readonly config: AppConfigService) {}

	async evaluate(input: TelegramPolicyHookContext): Promise<TelegramPolicyDecision> {
		if (input.command.access !== "admin") {
			return { allowed: true };
		}

		const from = input.ctx.from;
		if (!from) {
			return {
				allowed: false,
				reason: "command requires admin role but Telegram identity is missing",
				replyMessage: "This command is available only for admins.",
			};
		}

		if (this.config.telegramAdminIds.includes(from.id)) {
			return { allowed: true };
		}

		return {
			allowed: false,
			reason: "telegram user does not have admin role",
			replyMessage: "This command is available only for admins.",
		};
	}
}

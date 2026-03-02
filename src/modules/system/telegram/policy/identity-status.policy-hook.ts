import { Injectable } from "@nestjs/common";

import {
	GetIdentityAccessQuery,
	GetIdentityAccessQueryHandler,
} from "../../identity/application/queries/get-identity-access.query";
import type { TelegramPolicyDecision, TelegramPolicyHook, TelegramPolicyHookContext } from "../telegram.types";

@Injectable()
export class IdentityStatusPolicyHook implements TelegramPolicyHook {
	readonly name = "identity_status";

	constructor(private readonly getIdentityAccessQueryHandler: GetIdentityAccessQueryHandler) {}

	async evaluate(input: TelegramPolicyHookContext): Promise<TelegramPolicyDecision> {
		const from = input.ctx.from;
		if (!from) {
			return {
				allowed: false,
				reason: "telegram identity is missing in the update",
				replyMessage: "I can process commands only for Telegram users.",
			};
		}

		const identityAccess = await this.getIdentityAccessQueryHandler.execute(new GetIdentityAccessQuery(from.id));
		if (!identityAccess) {
			if (!input.command.requiresIdentity) {
				return { allowed: true };
			}

			return {
				allowed: false,
				reason: "identity is required but not registered",
				replyMessage: "Identity not found. Use /start first.",
			};
		}

		if (identityAccess.status === "blocked") {
			return {
				allowed: false,
				reason: "identity status is blocked",
				replyMessage: "Your account is blocked for this bot.",
			};
		}

		return { allowed: true };
	}
}

import { Injectable } from "@nestjs/common";

import {
	GetAdminDiagnosticsQuery,
	GetAdminDiagnosticsQueryHandler,
} from "../../application/queries/get-admin-diagnostics.query";
import type { TelegramBotContext, TelegramCommandHandler } from "../../../../system/telegram/telegram.types";

@Injectable()
export class TemplateAdminStatusCommandHandler implements TelegramCommandHandler {
	readonly command = "admin_status";
	readonly access = "admin";
	readonly featureFlag = "feature.template-admin-status";
	readonly requiresIdentity = true;
	readonly description = "Admin-only template diagnostics";

	constructor(private readonly getAdminDiagnosticsQueryHandler: GetAdminDiagnosticsQueryHandler) {}

	async execute(ctx: TelegramBotContext): Promise<void> {
		const diagnostics = await this.getAdminDiagnosticsQueryHandler.execute(new GetAdminDiagnosticsQuery());
		await ctx.reply(
			[
				"template diagnostics",
				`admins: ${diagnostics.adminsConfigured}`,
				`allowlist: ${diagnostics.allowlistConfigured}`,
				`features: ${diagnostics.enabledFeatures.join(", ") || "none"}`,
			].join("\n"),
		);
	}
}

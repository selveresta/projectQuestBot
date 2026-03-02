import { Injectable } from "@nestjs/common";

import { AppConfigService } from "../../../../../shared/config/app-config.service";

export class GetAdminDiagnosticsQuery {}

export interface AdminDiagnosticsView {
	adminsConfigured: number;
	allowlistConfigured: number;
	enabledFeatures: readonly string[];
}

@Injectable()
export class GetAdminDiagnosticsQueryHandler {
	constructor(private readonly config: AppConfigService) {}

	async execute(_query: GetAdminDiagnosticsQuery): Promise<AdminDiagnosticsView> {
		return {
			adminsConfigured: this.config.telegramAdminIds.length,
			allowlistConfigured: this.config.telegramAllowlistIds.length,
			enabledFeatures: [...this.config.enabledFeatures].sort(),
		};
	}
}

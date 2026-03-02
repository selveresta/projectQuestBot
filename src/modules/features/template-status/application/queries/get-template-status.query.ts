import { Inject, Injectable } from "@nestjs/common";

import { CLOCK_PORT, type ClockPort } from "../../../../../shared/application/ports/clock.port";
import { AppConfigService } from "../../../../../shared/config/app-config.service";

export class GetTemplateStatusQuery {}

export interface TemplateStatusView {
	timestamp: string;
	nodeEnv: "development" | "production";
	telegramMode: "polling" | "webhook";
	primaryDb: "redis" | "postgres";
}

@Injectable()
export class GetTemplateStatusQueryHandler {
	constructor(
		private readonly config: AppConfigService,
		@Inject(CLOCK_PORT) private readonly clock: ClockPort,
	) {}

	async execute(_query: GetTemplateStatusQuery): Promise<TemplateStatusView> {
		return {
			timestamp: this.clock.nowIso(),
			nodeEnv: this.config.nodeEnv,
			telegramMode: this.config.telegramMode,
			primaryDb: this.config.primaryDb,
		};
	}
}

import { Controller, Get } from "@nestjs/common";

import { AppConfigService } from "../config/app-config.service";

@Controller("health")
export class HealthController {
	constructor(private readonly config: AppConfigService) {}

	@Get()
	getHealth(): { status: "ok"; mode: "polling" | "webhook"; nodeEnv: "development" | "production"; timestamp: string } {
		return {
			status: "ok",
			mode: this.config.telegramMode,
			nodeEnv: this.config.nodeEnv,
			timestamp: new Date().toISOString(),
		};
	}
}

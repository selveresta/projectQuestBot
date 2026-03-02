import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";

import { AppConfigService } from "../config/app-config.service";
import { HealthService, type ReadinessReport } from "./health.service";

@Controller("health")
export class HealthController {
	constructor(
		private readonly config: AppConfigService,
		private readonly healthService: HealthService,
	) {}

	@Get("live")
	getLiveness(): {
		status: "ok";
		timestamp: string;
	} {
		return {
			status: "ok",
			timestamp: new Date().toISOString(),
		};
	}

	@Get("ready")
	async getReadiness(): Promise<{
		status: "ok";
		mode: "polling" | "webhook";
		nodeEnv: "development" | "production";
		primaryDb: "redis" | "postgres";
		readiness: ReadinessReport;
		timestamp: string;
	}> {
		const readiness = await this.healthService.checkReadiness();
		if (!readiness.ready) {
			throw new ServiceUnavailableException({
				status: "degraded",
				mode: this.config.telegramMode,
				nodeEnv: this.config.nodeEnv,
				primaryDb: this.config.primaryDb,
				readiness,
				timestamp: new Date().toISOString(),
			});
		}

		return {
			status: "ok",
			mode: this.config.telegramMode,
			nodeEnv: this.config.nodeEnv,
			primaryDb: this.config.primaryDb,
			readiness,
			timestamp: new Date().toISOString(),
		};
	}

}

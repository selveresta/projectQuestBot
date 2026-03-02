import { Inject, Injectable } from "@nestjs/common";
import { connect } from "amqplib";
import { sql } from "kysely";

import { AppConfigService } from "../config/app-config.service";
import { POSTGRES_DB } from "../persistence/postgres/postgres.constants";
import type { PostgresDatabaseClient } from "../persistence/postgres/postgres.provider";
import { REDIS_CLIENT } from "../persistence/redis/redis.constants";
import type { RedisClient } from "../persistence/redis/redis.provider";

export type DependencyHealthState = "up" | "down" | "skipped";

export interface DependencyHealth {
	state: DependencyHealthState;
	details?: string;
}

export interface ReadinessReport {
	ready: boolean;
	dependencies: {
		redis: DependencyHealth;
		postgres: DependencyHealth;
		broker: DependencyHealth;
	};
}

@Injectable()
export class HealthService {
	constructor(
		private readonly config: AppConfigService,
		@Inject(REDIS_CLIENT) private readonly redis: RedisClient,
		@Inject(POSTGRES_DB) private readonly postgresDb: PostgresDatabaseClient | null,
	) {}

	async checkReadiness(): Promise<ReadinessReport> {
		const [redis, postgres, broker] = await Promise.all([
			this.checkRedis(),
			this.checkPostgres(),
			this.checkBroker(),
		]);
		const ready = [redis, postgres, broker].every((item) => item.state !== "down");

		return {
			ready,
			dependencies: {
				redis,
				postgres,
				broker,
			},
		};
	}

	private async checkRedis(): Promise<DependencyHealth> {
		try {
			const pong = await this.redis.ping();
			if (pong !== "PONG") {
				return { state: "down", details: `Unexpected ping response: ${pong}` };
			}
			return { state: "up" };
		} catch (error) {
			return {
				state: "down",
				details: normalizeError(error),
			};
		}
	}

	private async checkPostgres(): Promise<DependencyHealth> {
		if (this.config.primaryDb !== "postgres") {
			return { state: "skipped", details: "PRIMARY_DB is not postgres" };
		}
		if (!this.postgresDb) {
			return { state: "down", details: "Postgres client is not initialized" };
		}

		try {
			await sql`select 1`.execute(this.postgresDb);
			return { state: "up" };
		} catch (error) {
			return {
				state: "down",
				details: normalizeError(error),
			};
		}
	}

	private async checkBroker(): Promise<DependencyHealth> {
		if (!this.config.brokerEnabled) {
			return { state: "skipped", details: "BROKER_ENABLED=false" };
		}

		try {
			const connection = await connect(this.config.amqpUrl);
			await connection.close();
			return { state: "up" };
		} catch (error) {
			return {
				state: "down",
				details: normalizeError(error),
			};
		}
	}
}

function normalizeError(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}

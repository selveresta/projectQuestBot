import { Inject, Injectable, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import { connect, type Channel, type ChannelModel, type ConsumeMessage, type GetMessage } from "amqplib";

import type {
	BroadcastChunkJob,
	BroadcastDlqJob,
	BroadcastQueuePort,
	BroadcastQueueStats,
} from "../../application/ports/broadcast-queue.port";
import { LOGGER_PORT, type LoggerPort } from "../../../../../shared/application/ports/logger.port";
import { AppConfigService } from "../../../../../shared/config/app-config.service";

const CHUNK_ROUTING_KEY = "campaign.chunk";
const DLQ_ROUTING_KEY = "campaign.chunk.dead";

@Injectable()
export class RabbitMqBroadcastQueueAdapter implements BroadcastQueuePort, OnModuleInit, OnApplicationShutdown {
	private connection: ChannelModel | null = null;
	private controlChannel: Channel | null = null;
	private readonly consumerChannels: Channel[] = [];
	private readonly consumerTags: string[] = [];
	private readonly dlxName: string;

	constructor(
		private readonly config: AppConfigService,
		@Inject(LOGGER_PORT) private readonly logger: LoggerPort,
	) {
		this.dlxName = `${this.config.broadcastExchange}.dlx`;
	}

	async onModuleInit(): Promise<void> {
		await this.ensureReady();
	}

	async onApplicationShutdown(): Promise<void> {
		await this.stopChunkConsumer();
		await this.controlChannel?.close();
		await this.connection?.close();
		this.controlChannel = null;
		this.connection = null;
	}

	async publishChunk(job: BroadcastChunkJob, delayMs?: number): Promise<void> {
		const channel = await this.requireControlChannel();
		const content = Buffer.from(JSON.stringify(job));

		if (delayMs && delayMs > 0) {
			await channel.sendToQueue(this.config.broadcastRetryQueue, content, {
				persistent: true,
				expiration: String(delayMs),
				contentType: "application/json",
			});
			return;
		}

		channel.publish(this.config.broadcastExchange, CHUNK_ROUTING_KEY, content, {
			persistent: true,
			contentType: "application/json",
		});
	}

	async publishDlq(job: BroadcastDlqJob): Promise<void> {
		const channel = await this.requireControlChannel();
		channel.publish(this.dlxName, DLQ_ROUTING_KEY, Buffer.from(JSON.stringify(job)), {
			persistent: true,
			contentType: "application/json",
		});
	}

	async startChunkConsumer(handler: (job: BroadcastChunkJob) => Promise<void>): Promise<void> {
		await this.ensureReady();
		if (this.consumerChannels.length > 0) {
			return;
		}

		for (let i = 0; i < this.config.broadcastConcurrency; i += 1) {
			if (!this.connection) {
				throw new Error("RabbitMQ connection is not initialized");
			}

			const channel = await this.connection.createChannel();
			await channel.prefetch(this.config.broadcastPrefetch);
			const consumeResult = await channel.consume(
				this.config.broadcastChunkQueue,
				async (message: ConsumeMessage | null) => {
					if (!message) {
						return;
					}
					await this.consumeMessage(channel, message, handler);
				},
			);

			this.consumerChannels.push(channel);
			this.consumerTags.push(consumeResult.consumerTag);
		}

		this.logger.info("broadcast_worker_consumer_started", {
			concurrency: this.config.broadcastConcurrency,
			prefetch: this.config.broadcastPrefetch,
			queue: this.config.broadcastChunkQueue,
		});
	}

	async stopChunkConsumer(): Promise<void> {
		if (this.consumerChannels.length === 0) {
			return;
		}

		for (let i = 0; i < this.consumerChannels.length; i += 1) {
			const channel = this.consumerChannels[i];
			const tag = this.consumerTags[i];
			try {
				await channel.cancel(tag);
			} catch {
				// no-op
			}
			await channel.close();
		}

		this.consumerChannels.length = 0;
		this.consumerTags.length = 0;
		this.logger.info("broadcast_worker_consumer_stopped");
	}

	async getQueueStats(): Promise<BroadcastQueueStats> {
		const channel = await this.requireControlChannel();
		const chunk = await channel.checkQueue(this.config.broadcastChunkQueue);
		const retry = await channel.checkQueue(this.config.broadcastRetryQueue);
		const dlq = await channel.checkQueue(this.config.broadcastDlqQueue);
		return {
			chunkReady: chunk.messageCount,
			retryReady: retry.messageCount,
			dlqReady: dlq.messageCount,
		};
	}

	async requeueDlq(limit: number): Promise<number> {
		if (limit <= 0) {
			return 0;
		}

		const channel = await this.requireControlChannel();
		let moved = 0;
		for (let i = 0; i < limit; i += 1) {
			const msg = await channel.get(this.config.broadcastDlqQueue, { noAck: false });
			if (!msg) {
				break;
			}

			const parsed = this.parseDlqMessage(msg);
			if (!parsed) {
				channel.ack(msg);
				continue;
			}

			await this.publishChunk({
				campaignId: parsed.campaignId,
				cursor: parsed.cursor,
				attempt: 0,
				trigger: "dlq_requeue",
			});
			channel.ack(msg);
			moved += 1;
		}

		return moved;
	}

	async discardDlq(limit: number): Promise<number> {
		if (limit <= 0) {
			return 0;
		}

		const channel = await this.requireControlChannel();
		let dropped = 0;
		for (let i = 0; i < limit; i += 1) {
			const msg = await channel.get(this.config.broadcastDlqQueue, { noAck: false });
			if (!msg) {
				break;
			}
			channel.ack(msg);
			dropped += 1;
		}

		return dropped;
	}

	private async consumeMessage(
		channel: Channel,
		message: ConsumeMessage,
		handler: (job: BroadcastChunkJob) => Promise<void>,
	): Promise<void> {
		const parsed = this.parseChunkMessage(message);
		if (!parsed) {
			channel.ack(message);
			this.logger.warn("broadcast_chunk_invalid_payload");
			return;
		}

		try {
			await handler(parsed);
			channel.ack(message);
		} catch (error) {
			this.logger.error("broadcast_chunk_handler_failed", {
				campaignId: parsed.campaignId,
				attempt: parsed.attempt,
				error: error instanceof Error ? error.message : String(error),
			});
			channel.nack(message, false, true);
		}
	}

	private parseChunkMessage(message: ConsumeMessage): BroadcastChunkJob | null {
		try {
			const parsed = JSON.parse(message.content.toString("utf-8")) as unknown;
			if (!parsed || typeof parsed !== "object") {
				return null;
			}

			const candidate = parsed as Partial<BroadcastChunkJob>;
			if (!candidate.campaignId || typeof candidate.campaignId !== "string") {
				return null;
			}
			if (typeof candidate.attempt !== "number") {
				return null;
			}
			return {
				campaignId: candidate.campaignId,
				cursor: typeof candidate.cursor === "string" ? candidate.cursor : undefined,
				attempt: candidate.attempt,
				trigger: candidate.trigger ?? "retry",
			};
		} catch {
			return null;
		}
	}

	private parseDlqMessage(message: GetMessage): BroadcastDlqJob | null {
		try {
			const parsed = JSON.parse(message.content.toString("utf-8")) as unknown;
			if (!parsed || typeof parsed !== "object") {
				return null;
			}
			const candidate = parsed as Partial<BroadcastDlqJob>;
			if (!candidate.campaignId || typeof candidate.campaignId !== "string") {
				return null;
			}
			if (typeof candidate.attempt !== "number") {
				return null;
			}

			return {
				campaignId: candidate.campaignId,
				cursor: typeof candidate.cursor === "string" ? candidate.cursor : undefined,
				attempt: candidate.attempt,
				errorCode: candidate.errorCode ?? "unknown",
				errorMessage: candidate.errorMessage ?? "unknown",
				failedAt: candidate.failedAt ?? new Date().toISOString(),
			};
		} catch {
			return null;
		}
	}

	private async requireControlChannel(): Promise<Channel> {
		await this.ensureReady();
		if (!this.controlChannel) {
			throw new Error("RabbitMQ control channel is not initialized");
		}
		return this.controlChannel;
	}

	private async ensureReady(): Promise<void> {
		if (this.connection && this.controlChannel) {
			return;
		}

		const connection: ChannelModel = await connect(this.config.amqpUrl);
		connection.on("error", (error) => {
			this.logger.error("rabbitmq_connection_error", {
				error: error instanceof Error ? error.message : String(error),
			});
		});
		connection.on("close", () => {
			this.logger.warn("rabbitmq_connection_closed");
		});

		const channel = await connection.createChannel();
		await channel.assertExchange(this.config.broadcastExchange, "direct", { durable: true });
		await channel.assertExchange(this.dlxName, "direct", { durable: true });
		await channel.assertQueue(this.config.broadcastChunkQueue, { durable: true });
		await channel.bindQueue(this.config.broadcastChunkQueue, this.config.broadcastExchange, CHUNK_ROUTING_KEY);

		await channel.assertQueue(this.config.broadcastRetryQueue, {
			durable: true,
			arguments: {
				"x-dead-letter-exchange": this.config.broadcastExchange,
				"x-dead-letter-routing-key": CHUNK_ROUTING_KEY,
			},
		});

		await channel.assertQueue(this.config.broadcastDlqQueue, { durable: true });
		await channel.bindQueue(this.config.broadcastDlqQueue, this.dlxName, DLQ_ROUTING_KEY);

		this.connection = connection;
		this.controlChannel = channel;
		this.logger.info("rabbitmq_broadcast_topology_ready", {
			amqpUrl: this.config.amqpUrl,
			exchange: this.config.broadcastExchange,
			chunkQueue: this.config.broadcastChunkQueue,
			retryQueue: this.config.broadcastRetryQueue,
			dlqQueue: this.config.broadcastDlqQueue,
		});
	}
}

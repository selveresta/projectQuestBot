export { BROADCAST_QUEUE_PORT } from "../../../../../shared/di/tokens";

export type BroadcastChunkJobTrigger = "start" | "resume" | "next" | "recovery" | "retry" | "dlq_requeue";

export interface BroadcastChunkJob {
	campaignId: string;
	cursor?: string;
	attempt: number;
	trigger: BroadcastChunkJobTrigger;
}

export interface BroadcastDlqJob {
	campaignId: string;
	cursor?: string;
	attempt: number;
	errorCode: string;
	errorMessage: string;
	failedAt: string;
}

export interface BroadcastQueueStats {
	chunkReady: number;
	retryReady: number;
	dlqReady: number;
}

export interface BroadcastQueuePort {
	publishChunk(job: BroadcastChunkJob, delayMs?: number): Promise<void>;
	publishDlq(job: BroadcastDlqJob): Promise<void>;
	startChunkConsumer(handler: (job: BroadcastChunkJob) => Promise<void>): Promise<void>;
	stopChunkConsumer(): Promise<void>;
	getQueueStats(): Promise<BroadcastQueueStats>;
	requeueDlq(limit: number): Promise<number>;
	discardDlq(limit: number): Promise<number>;
}

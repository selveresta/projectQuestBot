import { Inject, Injectable } from "@nestjs/common";

import { BROADCAST_QUEUE_PORT, type BroadcastQueuePort } from "../ports/broadcast-queue.port";

export interface BroadcastDlqView {
	chunkReady: number;
	retryReady: number;
	dlqReady: number;
}

export class GetBroadcastDlqQuery {}

@Injectable()
export class GetBroadcastDlqQueryHandler {
	constructor(
		@Inject(BROADCAST_QUEUE_PORT)
		private readonly queue: BroadcastQueuePort,
	) {}

	async execute(_query: GetBroadcastDlqQuery): Promise<BroadcastDlqView> {
		return this.queue.getQueueStats();
	}
}

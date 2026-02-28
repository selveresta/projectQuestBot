import { Inject, Injectable } from "@nestjs/common";

import { BROADCAST_QUEUE_PORT, type BroadcastQueuePort } from "../ports/broadcast-queue.port";

export class DiscardBroadcastDlqCommand {
	constructor(readonly limit: number) {}
}

@Injectable()
export class DiscardBroadcastDlqCommandHandler {
	constructor(
		@Inject(BROADCAST_QUEUE_PORT)
		private readonly queue: BroadcastQueuePort,
	) {}

	async execute(command: DiscardBroadcastDlqCommand): Promise<{ dropped: number }> {
		const limit = Math.max(1, Math.min(1000, command.limit));
		const dropped = await this.queue.discardDlq(limit);
		return { dropped };
	}
}

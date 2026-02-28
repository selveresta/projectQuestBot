import { Inject, Injectable } from "@nestjs/common";

import { BROADCAST_QUEUE_PORT, type BroadcastQueuePort } from "../ports/broadcast-queue.port";

export class RequeueBroadcastDlqCommand {
	constructor(readonly limit: number) {}
}

@Injectable()
export class RequeueBroadcastDlqCommandHandler {
	constructor(
		@Inject(BROADCAST_QUEUE_PORT)
		private readonly queue: BroadcastQueuePort,
	) {}

	async execute(command: RequeueBroadcastDlqCommand): Promise<{ moved: number }> {
		const limit = Math.max(1, Math.min(1000, command.limit));
		const moved = await this.queue.requeueDlq(limit);
		return { moved };
	}
}

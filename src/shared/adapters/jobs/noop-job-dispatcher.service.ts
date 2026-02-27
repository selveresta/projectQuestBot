import { Injectable } from "@nestjs/common";

import type { JobDispatcherPort } from "../../application/ports/job-dispatcher.port";

@Injectable()
export class NoopJobDispatcherService implements JobDispatcherPort {
	async dispatch<TPayload extends object>(_name: string, _payload: TPayload): Promise<void> {
		// Integration point for background workers (BullMQ, SQS, Kafka, etc.)
	}
}

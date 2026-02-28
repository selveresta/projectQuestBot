export { BROADCAST_MESSAGE_SENDER_PORT } from "../../../../../shared/di/tokens";

export type BroadcastSendFailureClassification = "rate_limit" | "transient" | "permanent";

export interface BroadcastSendFailure {
	classification: BroadcastSendFailureClassification;
	errorCode: string;
	description: string;
	retryAfterSeconds?: number;
}

export type BroadcastSendResult =
	| {
			ok: true;
	  }
	| {
			ok: false;
			failure: BroadcastSendFailure;
	  };

export interface BroadcastMessageSenderPort {
	sendText(chatId: number, text: string): Promise<BroadcastSendResult>;
}

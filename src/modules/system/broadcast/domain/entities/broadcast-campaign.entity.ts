import type { IsoDateString } from "../../../../../shared/domain/iso-date";
import { toIsoDateString } from "../../../../../shared/domain/iso-date";
import type { BroadcastCampaignId } from "../value-objects/broadcast-campaign-id";

export type BroadcastCampaignStatus = "draft" | "running" | "paused" | "canceled" | "completed";

export interface BroadcastCampaignSnapshot {
	id: BroadcastCampaignId;
	status: BroadcastCampaignStatus;
	messageText: string;
	audienceUsernamePrefix?: string;
	nextIdentityCursor?: string;
	totalRecipients: number;
	processedRecipients: number;
	succeededRecipients: number;
	failedRecipients: number;
	retryCount: number;
	dlqCount: number;
	lastErrorCode?: string;
	lastErrorMessage?: string;
	createdAt: IsoDateString;
	updatedAt: IsoDateString;
	startedAt?: IsoDateString;
	finishedAt?: IsoDateString;
}

export interface BroadcastChunkProgressDelta {
	processedDelta: number;
	succeededDelta: number;
	failedDelta: number;
	nextIdentityCursor?: string;
}

export class BroadcastCampaignEntity {
	private constructor(private readonly snapshot: BroadcastCampaignSnapshot) {}

	static createDraft(params: {
		id: BroadcastCampaignId;
		messageText: string;
		audienceUsernamePrefix?: string;
		now: IsoDateString;
	}): BroadcastCampaignEntity {
		const messageText = params.messageText.trim();
		if (!messageText) {
			throw new Error("Broadcast messageText cannot be empty");
		}

		const audienceUsernamePrefix = params.audienceUsernamePrefix?.trim();
		return BroadcastCampaignEntity.rehydrate({
			id: params.id,
			status: "draft",
			messageText,
			audienceUsernamePrefix: audienceUsernamePrefix || undefined,
			totalRecipients: 0,
			processedRecipients: 0,
			succeededRecipients: 0,
			failedRecipients: 0,
			retryCount: 0,
			dlqCount: 0,
			createdAt: params.now,
			updatedAt: params.now,
		});
	}

	static rehydrate(snapshot: BroadcastCampaignSnapshot): BroadcastCampaignEntity {
		if (
			snapshot.totalRecipients < 0 ||
			snapshot.processedRecipients < 0 ||
			snapshot.succeededRecipients < 0 ||
			snapshot.failedRecipients < 0
		) {
			throw new Error("Broadcast campaign counters must be non-negative");
		}
		if (snapshot.retryCount < 0 || snapshot.dlqCount < 0) {
			throw new Error("Broadcast campaign retry/dlq counters must be non-negative");
		}
		if (snapshot.processedRecipients < snapshot.succeededRecipients + snapshot.failedRecipients) {
			throw new Error("Broadcast processedRecipients cannot be less than succeeded+failed");
		}

		return new BroadcastCampaignEntity({
			...snapshot,
			createdAt: toIsoDateString(snapshot.createdAt),
			updatedAt: toIsoDateString(snapshot.updatedAt),
			startedAt: snapshot.startedAt ? toIsoDateString(snapshot.startedAt) : undefined,
			finishedAt: snapshot.finishedAt ? toIsoDateString(snapshot.finishedAt) : undefined,
		});
	}

	get id(): BroadcastCampaignId {
		return this.snapshot.id;
	}

	get status(): BroadcastCampaignStatus {
		return this.snapshot.status;
	}

	get messageText(): string {
		return this.snapshot.messageText;
	}

	get audienceUsernamePrefix(): string | undefined {
		return this.snapshot.audienceUsernamePrefix;
	}

	get nextIdentityCursor(): string | undefined {
		return this.snapshot.nextIdentityCursor;
	}

	get totalRecipients(): number {
		return this.snapshot.totalRecipients;
	}

	get processedRecipients(): number {
		return this.snapshot.processedRecipients;
	}

	get succeededRecipients(): number {
		return this.snapshot.succeededRecipients;
	}

	get failedRecipients(): number {
		return this.snapshot.failedRecipients;
	}

	get retryCount(): number {
		return this.snapshot.retryCount;
	}

	get dlqCount(): number {
		return this.snapshot.dlqCount;
	}

	get createdAt(): IsoDateString {
		return this.snapshot.createdAt;
	}

	get updatedAt(): IsoDateString {
		return this.snapshot.updatedAt;
	}

	get startedAt(): IsoDateString | undefined {
		return this.snapshot.startedAt;
	}

	get finishedAt(): IsoDateString | undefined {
		return this.snapshot.finishedAt;
	}

	get lastErrorCode(): string | undefined {
		return this.snapshot.lastErrorCode;
	}

	get lastErrorMessage(): string | undefined {
		return this.snapshot.lastErrorMessage;
	}

	toSnapshot(): BroadcastCampaignSnapshot {
		return { ...this.snapshot };
	}

	start(now: IsoDateString, totalRecipients: number): BroadcastCampaignEntity {
		if (this.snapshot.status === "canceled") {
			throw new Error("Canceled campaign cannot be started");
		}
		if (this.snapshot.status === "completed") {
			throw new Error("Completed campaign cannot be started");
		}

		return BroadcastCampaignEntity.rehydrate({
			...this.snapshot,
			status: "running",
			totalRecipients: Math.max(0, totalRecipients),
			startedAt: this.snapshot.startedAt ?? now,
			finishedAt: undefined,
			updatedAt: now,
		});
	}

	pause(now: IsoDateString): BroadcastCampaignEntity {
		return BroadcastCampaignEntity.rehydrate({
			...this.snapshot,
			status: "paused",
			updatedAt: now,
		});
	}

	resume(now: IsoDateString): BroadcastCampaignEntity {
		if (this.snapshot.status !== "paused") {
			throw new Error("Only paused campaign can be resumed");
		}
		return BroadcastCampaignEntity.rehydrate({
			...this.snapshot,
			status: "running",
			updatedAt: now,
		});
	}

	cancel(now: IsoDateString): BroadcastCampaignEntity {
		return BroadcastCampaignEntity.rehydrate({
			...this.snapshot,
			status: "canceled",
			finishedAt: now,
			updatedAt: now,
		});
	}

	complete(now: IsoDateString): BroadcastCampaignEntity {
		return BroadcastCampaignEntity.rehydrate({
			...this.snapshot,
			status: "completed",
			nextIdentityCursor: undefined,
			finishedAt: now,
			updatedAt: now,
		});
	}

	advanceProgress(delta: BroadcastChunkProgressDelta, now: IsoDateString): BroadcastCampaignEntity {
		if (delta.processedDelta < 0 || delta.succeededDelta < 0 || delta.failedDelta < 0) {
			throw new Error("Broadcast progress delta cannot be negative");
		}
		if (delta.processedDelta < delta.succeededDelta + delta.failedDelta) {
			throw new Error("Processed delta cannot be less than succeeded+failed delta");
		}

		return BroadcastCampaignEntity.rehydrate({
			...this.snapshot,
			processedRecipients: this.snapshot.processedRecipients + delta.processedDelta,
			succeededRecipients: this.snapshot.succeededRecipients + delta.succeededDelta,
			failedRecipients: this.snapshot.failedRecipients + delta.failedDelta,
			nextIdentityCursor: delta.nextIdentityCursor,
			updatedAt: now,
		});
	}

	recordRetry(now: IsoDateString, errorCode: string, errorMessage: string): BroadcastCampaignEntity {
		return BroadcastCampaignEntity.rehydrate({
			...this.snapshot,
			retryCount: this.snapshot.retryCount + 1,
			lastErrorCode: errorCode,
			lastErrorMessage: errorMessage,
			updatedAt: now,
		});
	}

	recordDlq(now: IsoDateString, errorCode: string, errorMessage: string): BroadcastCampaignEntity {
		return BroadcastCampaignEntity.rehydrate({
			...this.snapshot,
			dlqCount: this.snapshot.dlqCount + 1,
			lastErrorCode: errorCode,
			lastErrorMessage: errorMessage,
			updatedAt: now,
		});
	}
}

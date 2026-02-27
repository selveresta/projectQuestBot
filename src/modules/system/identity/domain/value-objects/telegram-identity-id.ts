import type { Brand } from "../../../../../shared/domain/brand";

export type TelegramIdentityId = Brand<number, "TelegramIdentityId">;

export function toTelegramIdentityId(value: number): TelegramIdentityId {
	if (!Number.isSafeInteger(value) || value <= 0) {
		throw new Error("TelegramIdentityId must be a positive integer");
	}
	return value as TelegramIdentityId;
}

import type { Brand } from "../../../../../shared/domain/brand";

export type TelegramUserId = Brand<number, "TelegramUserId">;

export function toTelegramUserId(value: number): TelegramUserId {
	if (!Number.isSafeInteger(value) || value <= 0) {
		throw new Error("TelegramUserId must be a positive integer");
	}
	return value as TelegramUserId;
}

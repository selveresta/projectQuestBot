import type { Brand } from "../../../../../shared/domain/brand";

export type UserId = Brand<string, "UserId">;

export function toUserId(value: string): UserId {
	const normalized = value.trim();
	if (!normalized) {
		throw new Error("UserId must be a non-empty string");
	}
	return normalized as UserId;
}

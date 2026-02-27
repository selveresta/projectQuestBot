import type { Brand } from "../../../../../shared/domain/brand";

export type IdentityId = Brand<string, "IdentityId">;

export function toIdentityId(value: string): IdentityId {
	const normalized = value.trim();
	if (!normalized) {
		throw new Error("IdentityId must be a non-empty string");
	}
	return normalized as IdentityId;
}

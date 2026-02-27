import type { Brand } from "./brand";

export type IsoDateString = Brand<string, "IsoDateString">;

export function toIsoDateString(value: string): IsoDateString {
	const normalized = value.trim();
	if (!normalized) {
		throw new Error("ISO date string is required");
	}

	const timestamp = Date.parse(normalized);
	if (Number.isNaN(timestamp)) {
		throw new Error(`Invalid ISO date string: ${value}`);
	}

	if (new Date(normalized).toISOString() !== normalized) {
		throw new Error(`Date must be in canonical ISO-8601 format: ${value}`);
	}

	return normalized as IsoDateString;
}

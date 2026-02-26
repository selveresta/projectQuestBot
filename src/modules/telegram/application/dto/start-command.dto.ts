import { z } from "zod";

const ReferralTokenSchema = z
	.string()
	.regex(/^\d+$/)
	.transform((value) => Number.parseInt(value, 10))
	.refine((value) => Number.isSafeInteger(value) && value > 0);

export interface StartCommandDto {
	referralId?: number;
}

export function parseStartCommandDto(text: string | undefined): StartCommandDto {
	const normalized = (text ?? "").trim();
	if (!normalized) {
		return {};
	}

	const parts = normalized.split(/\s+/);
	if (parts.length < 2) {
		return {};
	}

	const token = parts[1];
	if (!token) {
		return {};
	}

	const parsed = ReferralTokenSchema.safeParse(token);
	if (!parsed.success) {
		return {};
	}

	return {
		referralId: parsed.data,
	};
}

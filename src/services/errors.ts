export type UniqueContactField = "email" | "wallet" | "solanaWallet" | "xProfileUrl" | "instagramProfileUrl";

export class DuplicateContactError extends Error {
	constructor(
		public readonly field: UniqueContactField,
		public readonly value: string,
		public readonly conflictingUserId: number
	) {
		super(`Contact field ${field} with value "${value}" is already used by user ${conflictingUserId}.`);
		this.name = "DuplicateContactError";
	}
}

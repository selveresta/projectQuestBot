import type { QuestDefinition, QuestId } from "../types/quest";
import type { UserRecord } from "../types/user";
import { UserRepository } from "./userRepository";
import { DuplicateContactError, type UniqueContactField } from "./errors";

export interface QuestStatus {
	definition: QuestDefinition;
	completed: boolean;
	completedAt?: string;
	metadata?: string;
}

export interface QuestCompletionResult {
	user: UserRecord;
	referralRewardedReferrerId?: number;
}

const QUEST_POINT_VALUES: Partial<Record<QuestId, number>> = {
	telegram_channel: 2,
	telegram_chat: 2,
	discord_join: 2,
	x_follow: 2,
	instagram_follow: 2,
	website_visit: 2,
	email_submit: 4,
	wallet_submit: 1,
	sol_wallet_submit: 1,
};

const REFERRAL_BONUS_POINTS = 1;
const UNIQUE_CONTACT_FIELDS: UniqueContactField[] = ["email", "wallet", "solanaWallet", "xProfileUrl", "instagramProfileUrl"];
const UNIQUE_CONTACT_FIELD_SET = new Set<UniqueContactField>(UNIQUE_CONTACT_FIELDS);
type ContactField =
	| "email"
	| "wallet"
	| "solanaWallet"
	| "xProfileUrl"
	| "instagramProfileUrl"
	| "discordUserId";

interface UniqueContactEntry {
	field: UniqueContactField;
	value: string;
	normalized: string;
}

export class QuestService {
	private readonly definitions: QuestDefinition[];
	private readonly definitionMap: Map<QuestId, QuestDefinition>;
	private readonly mandatoryQuestIds: QuestId[];
	private readonly questIds: QuestId[];

	constructor(private readonly userRepository: UserRepository, definitions: QuestDefinition[]) {
		this.definitions = definitions;
		this.definitionMap = new Map(definitions.map((definition) => [definition.id, definition]));
		this.mandatoryQuestIds = definitions.filter((definition) => definition.mandatory).map((definition) => definition.id);
		this.questIds = definitions.map((definition) => definition.id);
	}

	getDefinitions(): QuestDefinition[] {
		return this.definitions;
	}

	getDefinition(questId: QuestId): QuestDefinition | undefined {
		return this.definitionMap.get(questId);
	}

	getQuestIds(): QuestId[] {
		return this.questIds;
	}

	getMandatoryQuestIds(): QuestId[] {
		return this.mandatoryQuestIds;
	}

	async getUser(userId: number): Promise<UserRecord> {
		return this.userRepository.getOrCreate(userId);
	}

	async hasCompletedQuest(userId: number, questId: QuestId): Promise<boolean> {
		const user = await this.userRepository.getOrCreate(userId);
		return Boolean(user.quests[questId]?.completed);
	}

	async completeQuest(userId: number, questId: QuestId, metadata?: string): Promise<QuestCompletionResult> {
		const user = await this.userRepository.getOrCreate(userId);
		const alreadyCompleted = Boolean(user.quests[questId]?.completed);
		const questCompletedUser = await this.userRepository.completeQuest(userId, questId, metadata);

		if (alreadyCompleted) {
			return { user: questCompletedUser };
		}

		let finalUser = questCompletedUser;
		const points = QUEST_POINT_VALUES[questId] ?? 0;
		if (points > 0) {
			finalUser = await this.userRepository.addQuestPoints(userId, questId, points);
		}

		return this.evaluateReferralProgress(finalUser);
	}

	async updateContact(
		userId: number,
		contact: Partial<Pick<UserRecord, "email" | "wallet" | "solanaWallet" | "xProfileUrl" | "instagramProfileUrl" | "discordUserId">>
	): Promise<UserRecord> {
		const entries = Object.entries(contact ?? {}) as [ContactField, string | undefined][];
		if (entries.length === 0) {
			return this.userRepository.getOrCreate(userId);
		}

		const sanitized: Partial<
			Pick<UserRecord, "email" | "wallet" | "solanaWallet" | "xProfileUrl" | "instagramProfileUrl" | "discordUserId">
		> = {};
		const uniqueEntries: UniqueContactEntry[] = [];

		for (const [field, rawValue] of entries) {
			if (typeof rawValue !== "string") {
				continue;
			}
			const trimmed = rawValue.trim();
			if (!trimmed) {
				continue;
			}

			if (this.isUniqueContactField(field)) {
				const normalized = this.normalizeContactValue(field, trimmed);
				uniqueEntries.push({
					field,
					value: trimmed,
					normalized,
				});
			}

			sanitized[field] = this.prepareContactValue(field, trimmed);
		}

		if (Object.keys(sanitized).length === 0) {
			return this.userRepository.getOrCreate(userId);
		}

		await this.ensureUniqueContactValues(userId, uniqueEntries);
		return this.userRepository.updateContact(userId, sanitized);
	}

	async saveQuestMetadata(userId: number, questId: QuestId, metadata: string): Promise<UserRecord> {
		return this.userRepository.setQuestMetadata(userId, questId, metadata);
	}

	async buildQuestStatus(userId: number): Promise<QuestStatus[]> {
		const user = await this.userRepository.getOrCreate(userId);
		return this.definitions.map((definition) => {
			const progress = user.quests[definition.id];
			return {
				definition,
				completed: Boolean(progress?.completed),
				completedAt: progress?.completedAt,
				metadata: progress?.metadata,
			};
		});
	}

	async isEligible(userId: number): Promise<boolean> {
		const user = await this.userRepository.getOrCreate(userId);
		return this.isUserEligible(user);
	}

	isUserEligible(user: UserRecord): boolean {
		const hasMandatoryQuests = this.mandatoryQuestIds.every((questId) => user.quests[questId]?.completed === true);
		return user.captchaPassed && hasMandatoryQuests;
	}

	async markTelegramChannel(userId: number): Promise<QuestCompletionResult> {
		return this.completeQuest(userId, "telegram_channel");
	}

	async markTelegramChat(userId: number): Promise<QuestCompletionResult> {
		return this.completeQuest(userId, "telegram_chat");
	}

	async markDiscordMembership(userId: number, metadata?: string): Promise<QuestCompletionResult> {
		return this.completeQuest(userId, "discord_join", metadata);
	}

	async countEligibleParticipants(): Promise<number> {
		return this.userRepository.countEligibleUsers(this.mandatoryQuestIds);
	}

	async getLeaderboard(limit: number): Promise<UserRecord[]> {
		return this.userRepository.getTopUsersByPoints(limit);
	}

	async getUserRank(userId: number): Promise<{ rank: number; points: number; total: number } | null> {
		return this.userRepository.getUserRank(userId);
	}

	private isUniqueContactField(field: ContactField): field is UniqueContactField {
		return UNIQUE_CONTACT_FIELD_SET.has(field as UniqueContactField);
	}

	private normalizeContactValue(field: UniqueContactField, value: string): string {
		const trimmed = value.trim();
		switch (field) {
			case "email":
				return trimmed.toLowerCase();
			case "wallet":
				return trimmed.toLowerCase();
			case "solanaWallet":
				return trimmed;
			case "xProfileUrl":
			case "instagramProfileUrl":
				return trimmed.replace(/\/+$/, "").toLowerCase();
			default:
				return trimmed;
		}
	}

	private prepareContactValue(field: ContactField, value: string): string {
		const trimmed = value.trim();
		switch (field) {
			case "email":
				return trimmed.toLowerCase();
			default:
				return trimmed;
		}
	}

	private async ensureUniqueContactValues(userId: number, entries: UniqueContactEntry[]): Promise<void> {
		if (entries.length === 0) {
			return;
		}

		const users = await this.userRepository.listAllUsers();
		if (users.length === 0) {
			return;
		}

		for (const entry of entries) {
			const conflict = users.find((candidate) => {
				if (candidate.userId === userId) {
					return false;
				}
				const candidateRaw = candidate[entry.field];
				if (typeof candidateRaw !== "string" || candidateRaw.trim().length === 0) {
					return false;
				}
				return this.normalizeContactValue(entry.field, candidateRaw) === entry.normalized;
			});

			if (conflict) {
				throw new DuplicateContactError(entry.field, entry.value, conflict.userId);
			}
		}
	}

	private async evaluateReferralProgress(user: UserRecord): Promise<QuestCompletionResult> {
		if (!user.referredBy || user.referralBonusClaimed) {
			return { user };
		}

		const hasCompletedQuest = Object.values(user.quests ?? {}).some((entry) => entry?.completed);
		if (!hasCompletedQuest) {
			return { user };
		}

		const referrer = await this.userRepository.awardReferralBonus(user.referredBy, user.userId, REFERRAL_BONUS_POINTS);
		const updatedUser = await this.userRepository.markReferralBonusClaimed(user.userId);
		if (referrer) {
			return { user: updatedUser, referralRewardedReferrerId: referrer.userId };
		}
		return { user: updatedUser };
	}
}

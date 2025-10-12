import type { QuestDefinition, QuestId } from "../types/quest";
import type { UserRecord } from "../types/user";
import { UserRepository } from "./userRepository";

export interface QuestStatus {
	definition: QuestDefinition;
	completed: boolean;
	completedAt?: string;
	metadata?: string;
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

	async completeQuest(userId: number, questId: QuestId, metadata?: string): Promise<UserRecord> {
		return this.userRepository.completeQuest(userId, questId, metadata);
	}

	async updateContact(
		userId: number,
		contact: Partial<
			Pick<UserRecord, "email" | "wallet" | "xProfileUrl" | "instagramProfileUrl" | "discordUserId">
		>
	): Promise<UserRecord> {
		return this.userRepository.updateContact(userId, contact);
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

	async markTelegramChannel(userId: number): Promise<UserRecord> {
		return this.completeQuest(userId, "telegram_channel");
	}

	async markTelegramChat(userId: number): Promise<UserRecord> {
		return this.completeQuest(userId, "telegram_chat");
	}

	async markDiscordMembership(userId: number, metadata?: string): Promise<UserRecord> {
		return this.completeQuest(userId, "discord_join", metadata);
	}

	async countEligibleParticipants(): Promise<number> {
		return this.userRepository.countEligibleUsers(this.mandatoryQuestIds);
	}
}

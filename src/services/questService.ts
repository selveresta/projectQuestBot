import type { QuestDefinition, QuestId } from "../types/quest";
import type { UserRecord } from "../types/user";
import { UserRepository } from "./userRepository";

export interface QuestStatus {
        definition: QuestDefinition;
        completed: boolean;
        completedAt?: string;
        metadata?: string;
}

const QUEST_POINT_VALUES: Partial<Record<QuestId, number>> = {
        telegram_channel: 2,
        telegram_chat: 2,
        discord_join: 2,
        x_follow: 2,
        instagram_follow: 2,
        x_like: 1,
        discord_like: 1,
        telegram_like: 1,
        email_submit: 4,
        wallet_submit: 1,
        sol_wallet_submit: 1,
};

const REFERRAL_BONUS_POINTS = 1;

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
                const user = await this.userRepository.getOrCreate(userId);
                const alreadyCompleted = Boolean(user.quests[questId]?.completed);
                const questCompletedUser = await this.userRepository.completeQuest(userId, questId, metadata);

                if (alreadyCompleted) {
                        return questCompletedUser;
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
                contact: Partial<
                        Pick<
                                UserRecord,
                                "email" | "wallet" | "solanaWallet" | "xProfileUrl" | "instagramProfileUrl" | "discordUserId"
                        >
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

        async getLeaderboard(limit: number): Promise<UserRecord[]> {
                return this.userRepository.getTopUsersByPoints(limit);
        }

        async getUserRank(userId: number): Promise<{ rank: number; points: number; total: number } | null> {
                return this.userRepository.getUserRank(userId);
        }

        private async evaluateReferralProgress(user: UserRecord): Promise<UserRecord> {
                if (!user.referredBy || user.referralBonusClaimed) {
                        return user;
                }

                const hasCompletedQuest = Object.values(user.quests ?? {}).some((entry) => entry?.completed);
                if (!hasCompletedQuest) {
                        return user;
                }

                await this.userRepository.awardReferralBonus(user.referredBy, user.userId, REFERRAL_BONUS_POINTS);
                return this.userRepository.markReferralBonusClaimed(user.userId);
        }
}

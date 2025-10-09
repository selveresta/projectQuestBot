import {
  MANDATORY_QUEST_IDS,
  QUEST_DEFINITIONS,
  type QuestDefinition,
  type QuestId,
} from "../types/quest";
import type { UserRecord } from "../types/user";
import { UserRepository } from "./userRepository";

export interface QuestStatus {
  definition: QuestDefinition;
  completed: boolean;
  completedAt?: string;
  metadata?: string;
}

export class QuestService {
  constructor(private readonly userRepository: UserRepository) {}

  getDefinitions(): QuestDefinition[] {
    return [...QUEST_DEFINITIONS];
  }

  async getUser(userId: number): Promise<UserRecord> {
    return this.userRepository.getOrCreate(userId);
  }

  async completeQuest(
    userId: number,
    questId: QuestId,
    metadata?: string,
  ): Promise<UserRecord> {
    return this.userRepository.completeQuest(userId, questId, metadata);
  }

  async updateContact(
    userId: number,
    contact: Partial<Pick<UserRecord, "email" | "wallet">>,
  ): Promise<UserRecord> {
    return this.userRepository.updateContact(userId, contact);
  }

  async buildQuestStatus(userId: number): Promise<QuestStatus[]> {
    const user = await this.userRepository.getOrCreate(userId);
    return QUEST_DEFINITIONS.map((definition) => {
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
    const hasMandatoryQuests = MANDATORY_QUEST_IDS.every(
      (questId) => user.quests[questId]?.completed === true,
    );
    return user.captchaPassed && hasMandatoryQuests;
  }

  async syncTelegramMembership(userId: number): Promise<UserRecord> {
    return this.userRepository.completeQuest(userId, "telegram_join");
  }

  async countEligibleParticipants(): Promise<number> {
    return this.userRepository.countEligibleUsers(MANDATORY_QUEST_IDS);
  }
}

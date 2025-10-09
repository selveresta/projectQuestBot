export const QUEST_DEFINITIONS = [
  {
    id: "telegram_join",
    title: "Join the Project Quest Telegram",
    description:
      "Join the official Telegram community channel to unlock access to the giveaway.",
    mandatory: true,
    type: "telegram_membership",
    phase: "live",
    cta: "Join channel",
  },
  {
    id: "x_follow",
    title: "Follow on X (Twitter)",
    description: "Follow the project account on X to stay on top of updates.",
    mandatory: true,
    type: "social_follow",
    phase: "stub",
    cta: "Open X profile",
  },
  {
    id: "website_visit",
    title: "Visit the Website",
    description: "Visit the official website to learn more about the project.",
    mandatory: true,
    type: "website_visit",
    phase: "stub",
    cta: "Open website",
  },
  {
    id: "email_submit",
    title: "Submit email address",
    description:
      "Provide an email so the team can reach out to winners and send updates.",
    mandatory: true,
    type: "email_collection",
    phase: "stub",
    cta: "Submit email",
  },
  {
    id: "wallet_submit",
    title: "Submit EVM wallet",
    description:
      "Share the EVM compatible wallet address where rewards can be delivered.",
    mandatory: true,
    type: "wallet_collection",
    phase: "stub",
    cta: "Submit wallet",
  },
] as const;

export type QuestDefinition = (typeof QUEST_DEFINITIONS)[number];
export type QuestId = QuestDefinition["id"];
export type QuestType = QuestDefinition["type"];
export type QuestPhase = QuestDefinition["phase"];

export const QUEST_ID_LIST = QUEST_DEFINITIONS.map((quest) => quest.id);

export const MANDATORY_QUEST_IDS = QUEST_DEFINITIONS.filter(
  (quest) => quest.mandatory,
).map((quest) => quest.id);

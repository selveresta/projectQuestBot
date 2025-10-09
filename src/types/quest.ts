export type QuestId =
  | "telegram_channel"
  | "telegram_chat"
  | "telegram_trady_bot"
  | "discord_join"
  | "x_follow"
  | "instagram_follow"
  | "website_visit"
  | "email_submit"
  | "wallet_submit";

export type QuestPhase = "live" | "stub";

export type QuestType =
  | "telegram_channel"
  | "telegram_chat"
  | "telegram_bot"
  | "discord_membership"
  | "social_follow"
  | "website_visit"
  | "email_collection"
  | "wallet_collection";

export interface QuestDefinition {
  id: QuestId;
  title: string;
  description: string;
  mandatory: boolean;
  type: QuestType;
  phase: QuestPhase;
  cta?: string;
  url?: string;
}

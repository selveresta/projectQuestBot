export type QuestId =
	| "telegram_channel"
	| "telegram_chat"
	| "discord_join"
	| "x_follow"
	| "instagram_follow"
	| "website_visit"
	| "email_submit"
	| "wallet_submit"
	| "x_like";

export type QuestPhase = "live" | "stub";

export type QuestType =
	| "telegram_channel"
	| "telegram_chat"
	| "telegram_bot"
	| "discord_membership"
	| "social_follow"
	| "social_engagement"
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

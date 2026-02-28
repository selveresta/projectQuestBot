import type { TelegramIdentityId } from "../../../modules/system/identity/domain/value-objects/telegram-identity-id";
import type { IdentityId } from "../../../modules/system/identity/domain/value-objects/identity-id";

export const RedisKeys = {
	identity: {
		entity: (identityId: IdentityId): string => `identity:${identityId}`,
		telegramIndex: (telegramId: TelegramIdentityId): string => `identity:tg:${telegramId}`,
		index: "identity:index",
	},
	broadcast: {
		campaign: (campaignId: string): string => `broadcast:campaign:${campaignId}`,
		statusIndex: (status: string): string => `broadcast:campaign:status:${status}`,
		recentIndex: "broadcast:campaign:recent",
		idempotencyRecipient: (campaignId: string, identityId: string): string =>
			`broadcast:idempotency:${campaignId}:${identityId}`,
	},
	cache: {
		identityProfile: (identityId: IdentityId): string => `cache:identity:${identityId}:profile`,
	},
	rateLimit: {
		scope: (scope: string, id: string): string => `rl:${scope}:${id}`,
	},
	telegram: {
		idempotency: (updateId: number): string => `telegram:update:${updateId}`,
		session: (sessionId: string): string => `telegram:session:${sessionId}`,
	},
} as const;

import type { TelegramUserId } from "../../../modules/system/identity/domain/value-objects/telegram-user-id";
import type { UserId } from "../../../modules/system/identity/domain/value-objects/user-id";

export const RedisKeys = {
	user: {
		entity: (userId: UserId): string => `user:${userId}`,
		telegramIndex: (telegramId: TelegramUserId): string => `user:tg:${telegramId}`,
	},
	cache: {
		userProfile: (userId: UserId): string => `cache:user:${userId}:profile`,
	},
	rateLimit: {
		scope: (scope: string, id: string): string => `rl:${scope}:${id}`,
	},
	telegram: {
		idempotency: (updateId: number): string => `telegram:update:${updateId}`,
		session: (sessionId: string): string => `telegram:session:${sessionId}`,
	},
} as const;

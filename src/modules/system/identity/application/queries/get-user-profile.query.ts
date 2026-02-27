import { Inject, Injectable } from "@nestjs/common";

import { USER_REPOSITORY, type UserRepositoryPort } from "../ports/user-repository.port";
import { toTelegramUserId } from "../../domain/value-objects/telegram-user-id";
import { CACHE_PORT, type CachePort } from "../../../../../shared/application/ports/cache.port";
import { RATE_LIMITER_PORT, type RateLimiterPort } from "../../../../../shared/application/ports/rate-limiter.port";

const PROFILE_CACHE_TTL_SECONDS = 45;

export interface UserProfileView {
	userId: string;
	telegramUserId: number;
	points: number;
	referredBy?: string;
}

export class GetUserProfileQuery {
	constructor(readonly telegramUserIdRaw: number) {}
}

@Injectable()
export class GetUserProfileQueryHandler {
	constructor(
		@Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort,
		@Inject(CACHE_PORT) private readonly cache: CachePort,
		@Inject(RATE_LIMITER_PORT) private readonly rateLimiter: RateLimiterPort,
	) {}

	async execute(query: GetUserProfileQuery): Promise<UserProfileView | null> {
		const telegramUserId = toTelegramUserId(query.telegramUserIdRaw);
		const decision = await this.rateLimiter.consume({
			key: `rl:per-user:${telegramUserId}`,
			points: 1,
			durationSeconds: 2,
		});
		if (!decision.allowed) {
			throw new Error("Rate limit exceeded for profile request");
		}

		const user = await this.userRepository.findByTelegramId(telegramUserId);
		if (!user) {
			return null;
		}

		const cacheKey = `cache:user:${user.id}:profile`;
		const cached = await this.cache.get<UserProfileView>(cacheKey);
		if (cached) {
			return cached;
		}

		const profile: UserProfileView = {
			userId: user.id,
			telegramUserId: user.telegramUserId,
			points: user.points,
			referredBy: user.referredBy,
		};

		await this.cache.set(cacheKey, profile, PROFILE_CACHE_TTL_SECONDS);
		return profile;
	}
}

import { Inject, Injectable } from "@nestjs/common";

import { IDENTITY_REPOSITORY, type IdentityRepositoryPort } from "../ports/identity-repository.port";
import { toTelegramIdentityId } from "../../domain/value-objects/telegram-identity-id";
import { CACHE_PORT, type CachePort } from "../../../../../shared/application/ports/cache.port";
import { RATE_LIMITER_PORT, type RateLimiterPort } from "../../../../../shared/application/ports/rate-limiter.port";

const PROFILE_CACHE_TTL_SECONDS = 45;

export interface IdentityProfileView {
	identityId: string;
	telegramIdentityId: number;
	points: number;
	referredBy?: string;
}

export class GetIdentityProfileQuery {
	constructor(readonly telegramIdentityIdRaw: number) {}
}

@Injectable()
export class GetIdentityProfileQueryHandler {
	constructor(
		@Inject(IDENTITY_REPOSITORY) private readonly identityRepository: IdentityRepositoryPort,
		@Inject(CACHE_PORT) private readonly cache: CachePort,
		@Inject(RATE_LIMITER_PORT) private readonly rateLimiter: RateLimiterPort,
	) {}

	async execute(query: GetIdentityProfileQuery): Promise<IdentityProfileView | null> {
		const telegramIdentityId = toTelegramIdentityId(query.telegramIdentityIdRaw);
		const decision = await this.rateLimiter.consume({
			key: `rl:per-identity:${telegramIdentityId}`,
			points: 1,
			durationSeconds: 2,
		});
		if (!decision.allowed) {
			throw new Error("Rate limit exceeded for profile request");
		}

		const identity = await this.identityRepository.findByTelegramId(telegramIdentityId);
		if (!identity) {
			return null;
		}

		const cacheKey = `cache:identity:${identity.id}:profile`;
		const cached = await this.cache.get<IdentityProfileView>(cacheKey);
		if (cached) {
			return cached;
		}

		const profile: IdentityProfileView = {
			identityId: identity.id,
			telegramIdentityId: identity.telegramIdentityId,
			points: identity.points,
			referredBy: identity.referredBy,
		};

		await this.cache.set(cacheKey, profile, PROFILE_CACHE_TTL_SECONDS);
		return profile;
	}
}

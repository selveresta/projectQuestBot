import { Inject, Injectable } from "@nestjs/common";

import { USER_REPOSITORY, type UserRepositoryPort } from "../ports/user-repository.port";
import { UserEntity } from "../../domain/entities/user.entity";
import type { UserRegisteredDomainEvent } from "../../domain/events/user-registered.event";
import { toTelegramUserId } from "../../domain/value-objects/telegram-user-id";
import { toUserId } from "../../domain/value-objects/user-id";
import { CLOCK_PORT, type ClockPort } from "../../../../../shared/application/ports/clock.port";
import { ID_GENERATOR_PORT, type IdGeneratorPort } from "../../../../../shared/application/ports/id-generator.port";
import { LOGGER_PORT, type LoggerPort } from "../../../../../shared/application/ports/logger.port";

export class RegisterTelegramUserCommand {
	constructor(
		readonly telegramUserId: number,
		readonly username?: string,
		readonly firstName?: string,
		readonly lastName?: string,
		readonly referrerTelegramUserId?: number,
	) {}
}

export interface RegisterTelegramUserResult {
	user: UserEntity;
	event?: UserRegisteredDomainEvent;
	referralRejectedReason?: "self_referral" | "referrer_not_found";
}

@Injectable()
export class RegisterTelegramUserCommandHandler {
	constructor(
		@Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort,
		@Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
		@Inject(CLOCK_PORT) private readonly clock: ClockPort,
		@Inject(LOGGER_PORT) private readonly logger: LoggerPort,
	) {}

	async execute(command: RegisterTelegramUserCommand): Promise<RegisterTelegramUserResult> {
		const telegramUserId = toTelegramUserId(command.telegramUserId);
		const existing = await this.userRepository.findByTelegramId(telegramUserId);
		const now = this.clock.nowIso();

		if (existing) {
			const updated = existing.withIdentity(
				{
					username: command.username,
					firstName: command.firstName,
					lastName: command.lastName,
				},
				now,
			);

			const referralApplied = await this.tryAssignReferrer(updated, command.referrerTelegramUserId, now);
			const finalUser = await this.applyReferralCreditIfNeeded(referralApplied.user, now);
			await this.userRepository.save(finalUser);
			return {
				user: finalUser,
				referralRejectedReason: referralApplied.rejectedReason,
			};
		}

		const user = UserEntity.createNew({
			id: toUserId(this.idGenerator.next()),
			telegramUserId,
			now,
			identity: {
				username: command.username,
				firstName: command.firstName,
				lastName: command.lastName,
			},
		});

		const referralApplied = await this.tryAssignReferrer(user, command.referrerTelegramUserId, now);
		const finalUser = await this.applyReferralCreditIfNeeded(referralApplied.user, now);
		await this.userRepository.save(finalUser);

		const event: UserRegisteredDomainEvent = {
			type: "identity.user_registered",
			userId: finalUser.id,
			telegramUserId: finalUser.telegramUserId,
			occurredAt: now,
		};
		this.logger.info("User registered", {
			userId: finalUser.id,
			telegramUserId: finalUser.telegramUserId,
		});

		return {
			user: finalUser,
			event,
			referralRejectedReason: referralApplied.rejectedReason,
		};
	}

	private async tryAssignReferrer(
		user: UserEntity,
		referrerTelegramUserId: number | undefined,
		now: ReturnType<ClockPort["nowIso"]>,
	): Promise<{ user: UserEntity; rejectedReason?: "self_referral" | "referrer_not_found" }> {
		if (!referrerTelegramUserId) {
			return { user };
		}

		const referrerTgId = toTelegramUserId(referrerTelegramUserId);
		if (referrerTgId === user.telegramUserId) {
			return { user, rejectedReason: "self_referral" };
		}

		const referrer = await this.userRepository.findByTelegramId(referrerTgId);
		if (!referrer) {
			return { user, rejectedReason: "referrer_not_found" };
		}

		return { user: user.assignReferrer(referrer.id, now) };
	}

	private async applyReferralCreditIfNeeded(
		user: UserEntity,
		now: ReturnType<ClockPort["nowIso"]>,
	): Promise<UserEntity> {
		if (!user.referredBy || user.referralBonusClaimed) {
			return user;
		}

		const referrer = await this.userRepository.getById(user.referredBy);
		if (!referrer) {
			return user;
		}

		const claimed = user.claimReferralBonus(now);
		const creditedReferrer = referrer.creditReferral(claimed.id, 1, now);
		await this.userRepository.save(creditedReferrer);
		return claimed;
	}
}

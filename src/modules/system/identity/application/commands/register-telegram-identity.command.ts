import { Inject, Injectable } from "@nestjs/common";

import { IDENTITY_REPOSITORY, type IdentityRepositoryPort } from "../ports/identity-repository.port";
import { IdentityEntity } from "../../domain/entities/identity.entity";
import type { IdentityRegisteredDomainEvent } from "../../domain/events/identity-registered.event";
import { toTelegramIdentityId } from "../../domain/value-objects/telegram-identity-id";
import { toIdentityId } from "../../domain/value-objects/identity-id";
import { CLOCK_PORT, type ClockPort } from "../../../../../shared/application/ports/clock.port";
import { ID_GENERATOR_PORT, type IdGeneratorPort } from "../../../../../shared/application/ports/id-generator.port";
import { LOGGER_PORT, type LoggerPort } from "../../../../../shared/application/ports/logger.port";

export class RegisterTelegramIdentityCommand {
	constructor(
		readonly telegramIdentityId: number,
		readonly username?: string,
		readonly firstName?: string,
		readonly lastName?: string,
		readonly referrerTelegramIdentityId?: number,
	) {}
}

export interface RegisterTelegramIdentityResult {
	identity: IdentityEntity;
	event?: IdentityRegisteredDomainEvent;
	referralRejectedReason?: "self_referral" | "referrer_not_found";
}

@Injectable()
export class RegisterTelegramIdentityCommandHandler {
	constructor(
		@Inject(IDENTITY_REPOSITORY) private readonly identityRepository: IdentityRepositoryPort,
		@Inject(ID_GENERATOR_PORT) private readonly idGenerator: IdGeneratorPort,
		@Inject(CLOCK_PORT) private readonly clock: ClockPort,
		@Inject(LOGGER_PORT) private readonly logger: LoggerPort,
	) {}

	async execute(command: RegisterTelegramIdentityCommand): Promise<RegisterTelegramIdentityResult> {
		const telegramIdentityId = toTelegramIdentityId(command.telegramIdentityId);
		const existing = await this.identityRepository.findByTelegramId(telegramIdentityId);
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

			const referralApplied = await this.tryAssignReferrer(updated, command.referrerTelegramIdentityId, now);
			const finalIdentity = await this.applyReferralCreditIfNeeded(referralApplied.identity, now);
			await this.identityRepository.save(finalIdentity);
			return {
				identity: finalIdentity,
				referralRejectedReason: referralApplied.rejectedReason,
			};
		}

		const identity = IdentityEntity.createNew({
			id: toIdentityId(this.idGenerator.next()),
			telegramIdentityId,
			now,
			identity: {
				username: command.username,
				firstName: command.firstName,
				lastName: command.lastName,
			},
		});

		const referralApplied = await this.tryAssignReferrer(identity, command.referrerTelegramIdentityId, now);
		const finalIdentity = await this.applyReferralCreditIfNeeded(referralApplied.identity, now);
		await this.identityRepository.save(finalIdentity);

		const event: IdentityRegisteredDomainEvent = {
			type: "identity.registered",
			identityId: finalIdentity.id,
			telegramIdentityId: finalIdentity.telegramIdentityId,
			occurredAt: now,
		};
		this.logger.info("Identity registered", {
			identityId: finalIdentity.id,
			telegramIdentityId: finalIdentity.telegramIdentityId,
		});

		return {
			identity: finalIdentity,
			event,
			referralRejectedReason: referralApplied.rejectedReason,
		};
	}

	private async tryAssignReferrer(
		identity: IdentityEntity,
		referrerTelegramIdentityId: number | undefined,
		now: ReturnType<ClockPort["nowIso"]>,
	): Promise<{ identity: IdentityEntity; rejectedReason?: "self_referral" | "referrer_not_found" }> {
		if (!referrerTelegramIdentityId) {
			return { identity };
		}

		const referrerTgId = toTelegramIdentityId(referrerTelegramIdentityId);
		if (referrerTgId === identity.telegramIdentityId) {
			return { identity, rejectedReason: "self_referral" };
		}

		const referrer = await this.identityRepository.findByTelegramId(referrerTgId);
		if (!referrer) {
			return { identity, rejectedReason: "referrer_not_found" };
		}

		return { identity: identity.assignReferrer(referrer.id, now) };
	}

	private async applyReferralCreditIfNeeded(
		identity: IdentityEntity,
		now: ReturnType<ClockPort["nowIso"]>,
	): Promise<IdentityEntity> {
		if (!identity.referredBy || identity.referralBonusClaimed) {
			return identity;
		}

		const referrer = await this.identityRepository.getById(identity.referredBy);
		if (!referrer) {
			return identity;
		}

		const claimed = identity.claimReferralBonus(now);
		const creditedReferrer = referrer.creditReferral(claimed.id, 1, now);
		await this.identityRepository.save(creditedReferrer);
		return claimed;
	}
}

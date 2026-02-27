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
	) {}
}

export interface RegisterTelegramIdentityResult {
	identity: IdentityEntity;
	event?: IdentityRegisteredDomainEvent;
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
			await this.identityRepository.save(updated);
			return {
				identity: updated,
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

		await this.identityRepository.save(identity);

		const event: IdentityRegisteredDomainEvent = {
			type: "identity.registered",
			identityId: identity.id,
			telegramIdentityId: identity.telegramIdentityId,
			occurredAt: now,
		};
		this.logger.info("Identity registered", {
			identityId: identity.id,
			telegramIdentityId: identity.telegramIdentityId,
		});

		return {
			identity,
			event,
		};
	}
}

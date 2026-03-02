import { Inject, Injectable } from "@nestjs/common";

import type { IdentityStatus } from "../../domain/entities/identity.entity";
import { toTelegramIdentityId } from "../../domain/value-objects/telegram-identity-id";
import { IDENTITY_REPOSITORY, type IdentityRepositoryPort } from "../ports/identity-repository.port";

export class GetIdentityAccessQuery {
	constructor(readonly telegramIdentityIdRaw: number) {}
}

export interface IdentityAccessView {
	identityId: string;
	status: IdentityStatus;
}

@Injectable()
export class GetIdentityAccessQueryHandler {
	constructor(@Inject(IDENTITY_REPOSITORY) private readonly identityRepository: IdentityRepositoryPort) {}

	async execute(query: GetIdentityAccessQuery): Promise<IdentityAccessView | null> {
		const telegramIdentityId = toTelegramIdentityId(query.telegramIdentityIdRaw);
		const identity = await this.identityRepository.findByTelegramId(telegramIdentityId);
		if (!identity) {
			return null;
		}

		return {
			identityId: identity.id,
			status: identity.status,
		};
	}
}

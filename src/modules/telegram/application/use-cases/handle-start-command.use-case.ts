import { Inject, Injectable } from "@nestjs/common";

import { ApplyReferralBonusUseCase } from "../../../referrals/application/apply-referral-bonus.use-case";
import type { UserEntity } from "../../domain/user.entity";
import { USER_REPOSITORY } from "../../telegram.constants";
import type { UserRepositoryPort } from "../ports/user-repository.port";

export interface HandleStartCommandInput {
	userId: number;
	username?: string;
	firstName?: string;
	lastName?: string;
	referralId?: number;
}

export type ReferralRejectionReason = "self_referral" | "already_registered";

export interface HandleStartCommandResult {
	user: UserEntity;
	referralAwarded: boolean;
	referralRejection: ReferralRejectionReason | null;
}

@Injectable()
export class HandleStartCommandUseCase {
	constructor(
		@Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort,
		private readonly applyReferralBonusUseCase: ApplyReferralBonusUseCase
	) {}

	async execute(input: HandleStartCommandInput): Promise<HandleStartCommandResult> {
		const existing = await this.userRepository.get(input.userId);
		let referralRejection: ReferralRejectionReason | null = null;

		if (input.referralId && input.referralId === input.userId) {
			referralRejection = "self_referral";
		} else if (input.referralId && existing?.referralBonusClaimed) {
			referralRejection = "already_registered";
		}

		let user = await this.userRepository.getOrCreate(input.userId, {
			username: input.username,
			firstName: input.firstName,
			lastName: input.lastName,
		});

		if (input.referralId && referralRejection === null) {
			user = await this.userRepository.setReferrerIfEmpty(user.userId, input.referralId);
		}

		let referralAwarded = false;
		if (user.referredBy && !user.referralBonusClaimed) {
			referralAwarded = await this.applyReferralBonusUseCase.execute({
				referrerId: user.referredBy,
				referredUserId: user.userId,
			});
		}

		if (referralAwarded) {
			const refreshed = await this.userRepository.get(user.userId);
			if (refreshed) {
				user = refreshed;
			}
		}

		return {
			user,
			referralAwarded,
			referralRejection,
		};
	}
}

import { Inject, Injectable } from "@nestjs/common";

import { USER_REPOSITORY } from "../../telegram.constants";
import type { UserRepositoryPort } from "../ports/user-repository.port";

export interface HandleStatusCommandInput {
	userId: number;
	username?: string;
	firstName?: string;
	lastName?: string;
}

export interface HandleStatusCommandResult {
	userId: number;
	points: number;
	referralsCount: number;
	referredBy?: number;
	referralBonusClaimed: boolean;
}

@Injectable()
export class HandleStatusCommandUseCase {
	constructor(@Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort) {}

	async execute(input: HandleStatusCommandInput): Promise<HandleStatusCommandResult> {
		const user = await this.userRepository.getOrCreate(input.userId, {
			username: input.username,
			firstName: input.firstName,
			lastName: input.lastName,
		});

		return {
			userId: user.userId,
			points: user.points,
			referralsCount: user.creditedReferrals.length,
			referredBy: user.referredBy,
			referralBonusClaimed: user.referralBonusClaimed,
		};
	}
}

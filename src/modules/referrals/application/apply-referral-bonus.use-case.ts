import { Inject, Injectable } from "@nestjs/common";

import { JOB_DISPATCHER, type JobDispatcherPort } from "../../../common/jobs/job-dispatcher.port";
import { USER_REPOSITORY } from "../../telegram/telegram.constants";
import type { UserRepositoryPort } from "../../telegram/application/ports/user-repository.port";
import { ReferralPolicy } from "../domain/referral-policy";

export interface ApplyReferralBonusInput {
	referrerId: number;
	referredUserId: number;
}

@Injectable()
export class ApplyReferralBonusUseCase {
	constructor(
		@Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort,
		private readonly policy: ReferralPolicy,
		@Inject(JOB_DISPATCHER) private readonly jobs: JobDispatcherPort
	) {}

	async execute(input: ApplyReferralBonusInput): Promise<boolean> {
		const referred = await this.userRepository.get(input.referredUserId);
		if (!referred || referred.referralBonusClaimed) {
			return false;
		}

		const points = this.policy.pointsPerReferral();
		if (points <= 0) {
			return false;
		}

		await this.userRepository.markReferralBonusClaimed(input.referredUserId);
		await this.userRepository.awardReferralBonus(input.referrerId, input.referredUserId, points);
		await this.jobs.dispatch("referral.awarded", {
			referrerId: input.referrerId,
			referredUserId: input.referredUserId,
			points,
		});

		return true;
	}
}

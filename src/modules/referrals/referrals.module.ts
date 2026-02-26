import { Module } from "@nestjs/common";

import { TelegramInfrastructureModule } from "../telegram/infrastructure/telegram-infrastructure.module";
import { ApplyReferralBonusUseCase } from "./application/apply-referral-bonus.use-case";
import { ReferralPolicy } from "./domain/referral-policy";

@Module({
	imports: [TelegramInfrastructureModule],
	providers: [ReferralPolicy, ApplyReferralBonusUseCase],
	exports: [ApplyReferralBonusUseCase],
})
export class ReferralsModule {}

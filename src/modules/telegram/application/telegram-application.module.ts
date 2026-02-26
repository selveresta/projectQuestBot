import { Module } from "@nestjs/common";

import { ReferralsModule } from "../../referrals/referrals.module";
import { TelegramInfrastructureModule } from "../infrastructure/telegram-infrastructure.module";
import { HandleStartCommandUseCase } from "./use-cases/handle-start-command.use-case";
import { HandleStatusCommandUseCase } from "./use-cases/handle-status-command.use-case";

@Module({
	imports: [TelegramInfrastructureModule, ReferralsModule],
	providers: [HandleStartCommandUseCase, HandleStatusCommandUseCase],
	exports: [HandleStartCommandUseCase, HandleStatusCommandUseCase],
})
export class TelegramApplicationModule {}

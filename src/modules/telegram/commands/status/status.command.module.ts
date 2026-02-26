import { Module } from "@nestjs/common";

import { TelegramApplicationModule } from "../../application/telegram-application.module";
import { StatusCommandHandler } from "./status.command-handler";

@Module({
	imports: [TelegramApplicationModule],
	providers: [StatusCommandHandler],
	exports: [StatusCommandHandler],
})
export class StatusCommandModule {}

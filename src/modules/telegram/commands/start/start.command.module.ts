import { Module } from "@nestjs/common";

import { TelegramApplicationModule } from "../../application/telegram-application.module";
import { StartCommandHandler } from "./start.command-handler";

@Module({
	imports: [TelegramApplicationModule],
	providers: [StartCommandHandler],
	exports: [StartCommandHandler],
})
export class StartCommandModule {}

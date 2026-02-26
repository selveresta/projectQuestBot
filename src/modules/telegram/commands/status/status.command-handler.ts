import { Injectable } from "@nestjs/common";

import { HandleStatusCommandUseCase } from "../../application/use-cases/handle-status-command.use-case";
import type { BotContext, TelegramCommandHandler } from "../../telegram.types";

@Injectable()
export class StatusCommandHandler implements TelegramCommandHandler {
	readonly command = "status";

	constructor(private readonly handleStatusCommandUseCase: HandleStatusCommandUseCase) {}

	async execute(ctx: BotContext): Promise<void> {
		if (!ctx.from) {
			await ctx.reply("I can only process this command for Telegram users.");
			return;
		}

		const result = await this.handleStatusCommandUseCase.execute({
			userId: ctx.from.id,
			username: ctx.from.username,
			firstName: ctx.from.first_name,
			lastName: ctx.from.last_name,
		});

		await ctx.reply(
			[
				`User: ${result.userId}`,
				`Points: ${result.points}`,
				`Referrals credited: ${result.referralsCount}`,
				`Referred by: ${result.referredBy ? `user ${result.referredBy}` : "none"}`,
				`Referral claimed: ${result.referralBonusClaimed ? "yes" : "no"}`,
			].join("\n")
		);
	}
}

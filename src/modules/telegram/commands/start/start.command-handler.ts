import { Injectable } from "@nestjs/common";

import type { BotContext, TelegramCommandHandler } from "../../telegram.types";
import { parseStartCommandDto } from "../../application/dto/start-command.dto";
import { HandleStartCommandUseCase } from "../../application/use-cases/handle-start-command.use-case";

@Injectable()
export class StartCommandHandler implements TelegramCommandHandler {
	readonly command = "start";

	constructor(private readonly handleStartCommandUseCase: HandleStartCommandUseCase) {}

	async execute(ctx: BotContext): Promise<void> {
		if (!ctx.from) {
			await ctx.reply("I can only process this command for Telegram users.");
			return;
		}

		const dto = parseStartCommandDto(ctx.message?.text);
		const result = await this.handleStartCommandUseCase.execute({
			userId: ctx.from.id,
			username: ctx.from.username,
			firstName: ctx.from.first_name,
			lastName: ctx.from.last_name,
			referralId: dto.referralId,
		});

		const lines = [
			"Welcome!",
			result.referralRejection === "self_referral" ? "You cannot use your own referral link." : "",
			result.referralRejection === "already_registered" ? "Referral link can only be applied once." : "",
			result.referralAwarded ? "Referral bonus applied." : "",
			`Points: ${result.user.points}`,
			`Referrals credited: ${result.user.creditedReferrals.length}`,
		] as string[];

		const filtered = lines.filter(Boolean);
		const referralLink = this.buildReferralLink(ctx);
		if (referralLink) {
			filtered.push("", "Your referral link:", referralLink);
		}

		await ctx.reply(filtered.join("\n"));
	}

	private buildReferralLink(ctx: BotContext): string | null {
		const username = ctx.me?.username;
		const userId = ctx.from?.id;
		if (!username || !userId) {
			return null;
		}
		return `https://t.me/${username}?start=${userId}`;
	}
}

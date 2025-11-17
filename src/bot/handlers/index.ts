import { Composer } from "grammy";

import type { BotContext } from "../../types/context";
import { CaptchaHandler } from "./captcha";
import { AdminCommandHandler } from "./commands/admin";
import { StartCommandHandler } from "./commands/start";
import { StatusCommandHandler } from "./commands/status";
import { ContactHandler } from "./contact";
import { StubQuestHandler } from "./questCompletion";
import { QuestListHandler } from "./questList";
import { SocialProfileHandler } from "./socialProfiles";
import { LeaderboardHandler } from "./leaderboard";
import { ReferralInviteHandler } from "./referralInvite";
import { WinnerFlowHandler } from "./winnerFlow";
import { GiveawayClosedHandler } from "./giveawayClosed";

export class BotHandlerRegistry {
	build(): Composer<BotContext> {
		const composer = new Composer<BotContext>();
		const captchaHandler = new CaptchaHandler();
		const winnerFlowHandler = new WinnerFlowHandler();
		const stubQuestHandler = new StubQuestHandler();
		const startCommandHandler = new StartCommandHandler();
		const statusCommandHandler = new StatusCommandHandler(stubQuestHandler);
		const adminCommandHandler = new AdminCommandHandler();
		const contactHandler = new ContactHandler();
		const questListHandler = new QuestListHandler();
		const socialProfileHandler = new SocialProfileHandler();
		const leaderboardHandler = new LeaderboardHandler();
		const referralInviteHandler = new ReferralInviteHandler();
		const giveawayClosedHandler = new GiveawayClosedHandler();

		// captchaHandler.register(composer);
		giveawayClosedHandler.register(composer);
		// startCommandHandler.register(composer);
		// statusCommandHandler.register(composer);
		adminCommandHandler.register(composer);
		winnerFlowHandler.register(composer);
		// contactHandler.register(composer);
		// questListHandler.register(composer);
		// socialProfileHandler.register(composer);
		// leaderboardHandler.register(composer);
		// referralInviteHandler.register(composer);
		// stubQuestHandler.register(composer);

		// composer.command("help", this.handleHelpCommand);
		return composer;
	}

	private async handleHelpCommand(ctx: BotContext): Promise<void> {
		await ctx.reply(
			[
				"Trady Quest Bot",
				"",
				"Commands:",
				"- /start — begin the giveaway flow",
				"- /status — check your quest progress",
				"- /quests — open the quest list",
				"- /admin — admin utilities (restricted)",
			].join("\n")
		);
	}
}

export function createBotHandlers(): Composer<BotContext> {
	return new BotHandlerRegistry().build();
}

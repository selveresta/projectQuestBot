import { Composer } from "grammy";

import type { BotContext } from "../../types/context";
import { getExistingSocialUrl, promptForSocialProfile, type SocialQuestId } from "../helpers/socialQuests";
import { BUTTON_SET_INSTAGRAM, BUTTON_SET_X } from "../ui/replyKeyboards";

export class SocialProfileHandler {
	register(composer: Composer<BotContext>): void {
		composer.hears(BUTTON_SET_INSTAGRAM, (ctx) => this.handlePrompt(ctx, "instagram_follow"));
		composer.hears(BUTTON_SET_X, (ctx) => this.handlePrompt(ctx, "x_follow"));
		// composer.hears(BUTTON_SET_DISCORD, (ctx) => this.handlePrompt(ctx, "discord_join"));
	}

	private async handlePrompt(ctx: BotContext, questId: SocialQuestId): Promise<void> {
		if (!ctx.from) {
			return;
		}

		const questService = ctx.services.questService;
		const definition = questService.getDefinition(questId);
		if (!definition || !definition.url) {
			await ctx.reply("This quest is currently disabled because the target profile is not configured.");
			return;
		}

		const userId = ctx.from.id;
		const user = await questService.getUser(userId);
		const existing = getExistingSocialUrl(user, questId);
		await promptForSocialProfile(ctx, questId, existing);
	}
}

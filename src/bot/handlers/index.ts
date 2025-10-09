import { Composer } from "grammy";

import type { BotContext } from "../../types/context";
import { registerCaptchaHandlers } from "./captcha";
import { registerAdminCommands } from "./commands/admin";
import { registerStartCommand } from "./commands/start";
import { registerStatusCommand } from "./commands/status";
import { registerContactHandlers } from "./contact";
import { registerQuestCompletionHandlers } from "./questCompletion";

export function createBotHandlers(): Composer<BotContext> {
	const composer = new Composer<BotContext>();

	registerCaptchaHandlers(composer);
	registerStartCommand(composer);
	registerStatusCommand(composer);
	registerAdminCommands(composer);
	registerContactHandlers(composer);
	registerQuestCompletionHandlers(composer);

	composer.command("help", async (ctx) => {
		await ctx.reply(
			[
				"Project Quest Bot",
				"",
				"Commands:",
				"- /start — begin the giveaway flow",
				"- /status — check your quest progress",
				"- /admin — admin utilities (restricted)",
			].join("\n")
		);
	});

	return composer;
}

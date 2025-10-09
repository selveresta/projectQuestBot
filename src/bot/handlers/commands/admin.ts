import { Composer } from "grammy";

import type { BotContext } from "../../../types/context";

export function registerAdminCommands(composer: Composer<BotContext>): void {
	composer.command("admin", async (ctx) => {
		if (!ctx.from) {
			return;
		}

		if (!ctx.config.adminIds.includes(ctx.from.id)) {
			await ctx.reply("This command is restricted to admins.");
			return;
		}

		const repo = ctx.services.userRepository;
		const questService = ctx.services.questService;

		const users = await repo.listAllUsers();
		const eligibleCount = await questService.countEligibleParticipants();
		const captchaPassed = users.filter((user) => user.captchaPassed).length;

		await ctx.reply(
			[
				"Admin dashboard:",
				`Total users: ${users.length}`,
				`Captcha passed: ${captchaPassed}`,
				`Eligible for giveaway: ${eligibleCount}`,
				"",
				"Phase 2 tasks are stubbed and will require external integrations.",
			].join("\n")
		);
	});
}

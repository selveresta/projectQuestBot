import { Bot } from "grammy";

import type { AppConfig } from "../config";
import { createRedisClient } from "../infra/redis";
import { CaptchaService } from "../services/captchaService";
import { QuestService } from "../services/questService";
import { UserRepository } from "../services/userRepository";
import type { BotContext } from "../types/context";
import { createBotHandlers } from "./handlers";

export interface BotContainer {
	bot: Bot<BotContext>;
	dispose: () => Promise<void>;
}

export async function buildBot(config: AppConfig): Promise<BotContainer> {
	const redis = await createRedisClient(config.redisUrl);
	const userRepository = new UserRepository(redis);
	const questService = new QuestService(userRepository);
	const captchaService = new CaptchaService();

	const bot = new Bot<BotContext>(config.botToken);

	bot.use(async (ctx, next) => {
		ctx.config = config;
		ctx.services = {
			redis,
			userRepository,
			questService,
			captchaService,
		};
		await next();
	});

	bot.use(createBotHandlers());

	return {
		bot,
		dispose: async () => {
			await redis.quit();
		},
	};
}

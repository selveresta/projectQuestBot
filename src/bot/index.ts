import { Bot } from "grammy";

import type { AppConfig } from "../config";
import { createQuestDefinitions } from "../quests/catalog";
import { CaptchaService } from "../services/captchaService";
import { QuestService } from "../services/questService";
import { UserRepository } from "../services/userRepository";
import type { BotContext } from "../types/context";
import { BotHandlerRegistry } from "./handlers";
import { acquireRedisClient, releaseRedisClient, type RedisClient } from "../infra/redis";

export class BotApplication {
	private redisClient: RedisClient | null = null;
	private questService: QuestService | null = null;
	private userRepository: UserRepository | null = null;
	private captchaService: CaptchaService | null = null;
	private bot: Bot<BotContext> | null = null;

	constructor(private readonly config: AppConfig) {}

	async initialise(): Promise<void> {
		this.redisClient = await acquireRedisClient(this.config.redisUrl);
		const questDefinitions = createQuestDefinitions(this.config);
		const questIds = questDefinitions.map((definition) => definition.id);
		this.userRepository = new UserRepository(this.redisClient, questIds);
		this.questService = new QuestService(this.userRepository, questDefinitions);
		this.captchaService = new CaptchaService();
		this.bot = new Bot<BotContext>(this.config.botToken);

		this.bot.use(async (ctx, next) => {
			ctx.config = this.config;
			ctx.services = {
				redis: this.requireRedisClient(),
				userRepository: this.requireUserRepository(),
				questService: this.requireQuestService(),
				captchaService: this.requireCaptchaService(),
			};
			await next();
		});

		const handlerRegistry = new BotHandlerRegistry();
		this.bot.use(handlerRegistry.build());
	}

	getBot(): Bot<BotContext> {
		return this.requireBot();
	}

	async dispose(): Promise<void> {
		this.bot = null;
		this.captchaService = null;
		this.questService = null;
		this.userRepository = null;
		await releaseRedisClient();
		this.redisClient = null;
	}

	private requireBot(): Bot<BotContext> {
		if (!this.bot) {
			throw new Error("BotApplication has not been initialised");
		}
		return this.bot;
	}

	private requireRedisClient(): RedisClient {
		if (!this.redisClient) {
			throw new Error("Redis client not available");
		}
		return this.redisClient;
	}

	private requireQuestService(): QuestService {
		if (!this.questService) {
			throw new Error("Quest service not available");
		}
		return this.questService;
	}

	private requireUserRepository(): UserRepository {
		if (!this.userRepository) {
			throw new Error("User repository not available");
		}
		return this.userRepository;
	}

	private requireCaptchaService(): CaptchaService {
		if (!this.captchaService) {
			throw new Error("Captcha service not available");
		}
		return this.captchaService;
	}
}

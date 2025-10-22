import { Bot, GrammyError } from "grammy";
import type { Message } from "grammy/types";

import type { AppConfig } from "../config";
import { createQuestDefinitions } from "../quests/catalog";
import { CaptchaService } from "../services/captchaService";
import { QuestService } from "../services/questService";
import { UserRepository } from "../services/userRepository";
import type { BotContext } from "../types/context";
import { createBotHandlers } from "./handlers";
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
			const answerCallback = ctx.answerCallbackQuery.bind(ctx);
			ctx.answerCallbackQuery = (async (...args) => {
				try {
					return await answerCallback(...args);
				} catch (error) {
					if (shouldSuppressCallbackQueryError(error)) {
						console.warn("[bot] ignored answerCallbackQuery error", { error });
						return;
					}
					throw error;
				}
			}) as typeof ctx.answerCallbackQuery;

			ctx.config = this.config;
			ctx.services = {
				redis: this.requireRedisClient(),
				userRepository: this.requireUserRepository(),
				questService: this.requireQuestService(),
				captchaService: this.requireCaptchaService(),
			};
			await next();
		});

		this.bot.use(async (ctx, next) => {
			const chatType = ctx.chat?.type;
			if (!chatType || chatType === "private") {
				await next();
				return;
			}

			const restrictionNotice = "Please interact with me in a private chat.";
			if (ctx.update.callback_query) {
				try {
					console.warn(restrictionNotice);
				} catch (error) {
					if (!shouldSuppressCallbackQueryError(error)) {
						throw error;
					}
				}
				return;
			}
		});

		this.bot.use(createBotHandlers());
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

function shouldSuppressCallbackQueryError(error: unknown): boolean {
	if (error instanceof GrammyError && typeof error.description === "string") {
		const normalized = error.description.toLowerCase();
		return normalized.includes("query is too old") || normalized.includes("query id is invalid");
	}
	return false;
}

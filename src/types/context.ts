import type { Context } from "grammy";

import type { AppConfig } from "../config";
import type { RedisClient } from "../infra/redis";
import type { CaptchaService } from "../services/captchaService";
import type { QuestService } from "../services/questService";
import type { UserRepository } from "../services/userRepository";

export interface BotServices {
	redis: RedisClient;
	userRepository: UserRepository;
	questService: QuestService;
	captchaService: CaptchaService;
}

export type BotContext = Context & {
	config: AppConfig;
	services: BotServices;
};

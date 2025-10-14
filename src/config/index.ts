import { config as loadEnv } from "dotenv";

loadEnv();

export interface TelegramConfig {
	channelId: string;
	channelUrl: string;
	chatId: string;
	chatUrl: string;
}

export interface LinksConfig {
	xProfileUrl: string;
	instagramProfileUrl: string;
	websiteUrl: string;
	discordInviteUrl: string;
}

export interface DiscordConfig {
	guildId: string;
	channelId: string;
	botToken: string;
}

export interface AppConfig {
	botToken: string;
	redisUrl: string;
	adminIds: number[];
	captchaRetries: number;
	telegram: TelegramConfig;
	links: LinksConfig;
	discord: DiscordConfig;
}

export class AppConfiguration implements AppConfig {
	readonly botToken: string;
	readonly redisUrl: string;
	readonly adminIds: number[];
	readonly captchaRetries: number;
	readonly telegram: TelegramConfig;
	readonly links: LinksConfig;
	readonly discord: DiscordConfig;

	private constructor(env: NodeJS.ProcessEnv) {
		this.botToken = this.require(env.BOT_TOKEN, "BOT_TOKEN");
		this.redisUrl = env.REDIS_URL ?? "redis://127.0.0.1:6379";
		this.adminIds = this.parseAdminIds(env.ADMIN_IDS);
		this.captchaRetries = this.parseCaptchaRetries(env.CAPTCHA_RETRIES);

		this.telegram = {
			channelId: env.TELEGRAM_CHANNEL_ID ?? "",
			channelUrl: env.TELEGRAM_CHANNEL_URL ?? "",
			chatId: env.TELEGRAM_CHAT_ID ?? "",
			chatUrl: env.TELEGRAM_CHAT_URL ?? "",
		};

		this.links = {
			xProfileUrl: env.X_PROFILE_URL ?? "",
			instagramProfileUrl: env.INSTAGRAM_PROFILE_URL ?? "",
			websiteUrl: env.WEBSITE_URL ?? "",
			discordInviteUrl: env.DISCORD_INVITE_URL ?? "",
		};

		this.discord = {
			guildId: env.DISCORD_GUILD_ID ?? "",
			channelId: env.DISCORD_CHANNEL_ID ?? "",
			botToken: env.DISCORD_BOT_TOKEN ?? "",
		};
	}

	static load(env: NodeJS.ProcessEnv = process.env): AppConfiguration {
		return new AppConfiguration(env);
	}

	private require(value: string | undefined, key: string): string {
		if (!value) {
			throw new Error(`${key} is not set`);
		}
		return value;
	}

	private parseAdminIds(value: string | undefined): number[] {
		return (value ?? "")
			.split(",")
			.map((item) => item.trim())
			.filter(Boolean)
			.map((item) => Number.parseInt(item, 10))
			.filter((item) => Number.isInteger(item));
	}

	private parseCaptchaRetries(value: string | undefined): number {
		const parsed = Number.parseInt(value ?? "3", 10);
		return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 3;
	}
}

export const appConfig = AppConfiguration.load();

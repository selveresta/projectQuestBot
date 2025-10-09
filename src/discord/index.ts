import { Client, GatewayIntentBits, Partials } from "discord.js";

import { appConfig, type AppConfig } from "../config";
import { acquireRedisClient, releaseRedisClient, type RedisClient } from "../infra/redis";
import { createQuestDefinitions } from "../quests/catalog";
import { QuestService } from "../services/questService";
import { UserRepository } from "../services/userRepository";

export class DiscordVerifier {
	private readonly client: Client;
	private redisClient: RedisClient | null = null;
	private questService: QuestService | null = null;

	constructor(private readonly config: AppConfig) {
		this.client = new Client({
			intents: [
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildMembers,
				GatewayIntentBits.GuildMessages,
				GatewayIntentBits.MessageContent,
			],
			partials: [Partials.GuildMember],
		});
	}

	async start(): Promise<void> {
		if (!this.config.discord.botToken) {
			throw new Error("DISCORD_BOT_TOKEN is not set. Cannot start Discord verifier.");
		}

		await this.initialiseServices();
		this.registerEventHandlers();
		await this.client.login(this.config.discord.botToken);

		process.once("SIGINT", () => this.shutdown());
		process.once("SIGTERM", () => this.shutdown());
	}

	private async initialiseServices(): Promise<void> {
		this.redisClient = await acquireRedisClient(this.config.redisUrl);
		const questDefinitions = createQuestDefinitions(this.config);
		const questIds = questDefinitions.map((definition) => definition.id);
		const userRepository = new UserRepository(this.redisClient, questIds);
		this.questService = new QuestService(userRepository, questDefinitions);
	}

	private registerEventHandlers(): void {
		this.client.once("ready", () => {
			console.log(`[discord] Logged in as ${this.client.user?.tag ?? "unknown user"}`);
		});

		this.client.on("messageCreate", async (message) => {
			if (message.author.bot) {
				return;
			}
			try {
				await this.handleMessage(message.content.trim(), message.guildId ?? "", message.channelId, message.author.id, async (reply) => {
					await message.reply(reply);
				});
			} catch (error) {
				console.error("[discord] message handler failed", error);
			}
		});
	}

	private async handleMessage(
		content: string,
		guildId: string,
		channelId: string,
		authorId: string,
		reply: (message: string) => Promise<void>
	): Promise<void> {
		if (authorId === this.client.user?.id) {
			return;
		}

		if (this.config.discord.guildId && guildId !== this.config.discord.guildId) {
			return;
		}

		if (this.config.discord.channelId && channelId !== this.config.discord.channelId) {
			return;
		}

		if (!content.toLowerCase().startsWith("!verify")) {
			return;
		}

		const [, telegramIdRaw] = content.split(/\s+/, 2);
		if (!telegramIdRaw) {
			await reply("Usage: !verify <telegram-id> — grab your numeric ID from /status in Telegram.");
			return;
		}

		const telegramId = Number.parseInt(telegramIdRaw, 10);
		if (!Number.isSafeInteger(telegramId)) {
			await reply("The Telegram ID must be a number. Try again with /status in Telegram to copy it.");
			return;
		}

		const questService = this.requireQuestService();
		const alreadyCompleted = await questService.hasCompletedQuest(telegramId, "discord_join");
		if (alreadyCompleted) {
			await reply("You are already verified for the giveaway. See /status in Telegram for details.");
			return;
		}

		await questService.updateContact(telegramId, { discordUserId: authorId });
		await questService.markDiscordMembership(telegramId, `discord:${authorId}`);
		await reply("Verification recorded! Use /status in Telegram to confirm your progress.");
	}

	private requireQuestService(): QuestService {
		if (!this.questService) {
			throw new Error("Quest service not initialised");
		}
		return this.questService;
	}

	private async shutdown(): Promise<void> {
		console.log("[discord] shutting down");
		this.client.removeAllListeners();
		if (this.client.isReady()) {
			this.client.destroy();
		}
		await releaseRedisClient();
		this.redisClient = null;
		this.questService = null;
	}
}

export async function startDiscordVerifier(customConfig: AppConfig = appConfig): Promise<void> {
	const verifier = new DiscordVerifier(customConfig);
	await verifier.start();
}


import { Bot } from "grammy";

const DISCORD_COMPLETION_MESSAGE = "Discord quest Completed ✅";

export class TelegramNotifier {
	private readonly bot: Bot;

	constructor(botToken: string) {
		if (!botToken) {
			throw new Error("BOT_TOKEN is required to initialise TelegramNotifier");
		}
		this.bot = new Bot(botToken);
	}

	async notifyDiscordQuestCompleted(userId: number): Promise<void> {
		await this.safeSendMessage(userId, DISCORD_COMPLETION_MESSAGE);
	}

	private async safeSendMessage(userId: number, text: string): Promise<void> {
		try {
			await this.bot.api.sendMessage(userId, text, { link_preview_options: { is_disabled: true } });
		} catch (error) {
			console.error("[telegramNotifier] Failed to send message", {
				userId,
				text,
				error,
			});
		}
	}
}

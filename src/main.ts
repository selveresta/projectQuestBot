import { AppConfiguration } from "./config";
import { BotApplication } from "./bot";
import { startDiscordVerifier } from "./discord";

async function bootstrap(): Promise<void> {
	const config = AppConfiguration.load();
	const application = new BotApplication(config);
	await application.initialise();
	const bot = application.getBot();

	try {
		await bot.api.deleteWebhook({ drop_pending_updates: true });
	} catch (error) {
		await application.dispose();
		throw error;
	}

	const stop = async () => {
		try {
			bot.stop();
		} finally {
			await application.dispose();
		}
	};

	process.once("SIGINT", stop);
	process.once("SIGTERM", stop);

	bot.start({
		drop_pending_updates: true,
		allowed_updates: ["message", "callback_query"],
	}).catch(async (error) => {
		console.error("Failed to start bot", error);
		await application.dispose();
	});

	startDiscordVerifier().catch((error) => {
		console.error("[discord] fatal error", error);
		process.exitCode = 1;
	});
}

bootstrap().catch((error) => {
	console.error("Fatal startup error", error);
	process.exitCode = 1;
});

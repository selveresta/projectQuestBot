import { AppConfiguration } from "./config";
import { BotApplication } from "./bot";
import { startDiscordVerifier } from "./discord";

async function bootstrap(): Promise<void> {
	const config = AppConfiguration.load();
	const application = new BotApplication(config);
	await application.initialise();
	const bot = application.getBot();
	const stop = async () => {
		try {
			bot.stop();
		} finally {
			await application.dispose();
		}
	};

	process.once("SIGINT", stop);
	process.once("SIGTERM", stop);

	startDiscordVerifier()
		.catch((error) => {
			console.error("[discord] fatal error", error);
			process.exitCode = 1;
		})
		.finally(() => {
			bot.start({
				drop_pending_updates: true,
				allowed_updates: ["message", "callback_query"],
			}).catch(async (error) => {
				console.error("Failed to start bot", error);
				await application.dispose();
			});
		});
}

bootstrap().catch((error) => {
	console.error("Fatal startup error", error);
	process.exitCode = 1;
});

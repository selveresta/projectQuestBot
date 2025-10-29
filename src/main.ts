import { AppConfiguration } from "./config";
import { BotApplication } from "./bot";
import { startDiscordVerifier } from "./discord";

async function bootstrap(): Promise<void> {
	const config = AppConfiguration.load();
	const application = new BotApplication(config);
	await application.initialise();
	const stop = async () => {
		try {
			await application.dispose();
		} catch (error) {
			console.error("Error while disposing application", error);
		}
	};

	process.once("SIGINT", stop);
	process.once("SIGTERM", stop);

	startDiscordVerifier().catch((error) => {
		console.error("[discord] fatal error", error);
		process.exitCode = 1;
	});

	try {
		await application.start();
	} catch (error) {
		console.error("Failed to start bot", error);
		process.exitCode = 1;
		await application.dispose();
	}
}

bootstrap().catch((error) => {
	console.error("Fatal startup error", error);
	process.exitCode = 1;
});

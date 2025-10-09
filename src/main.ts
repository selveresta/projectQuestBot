import { appConfig } from "./config";
import { buildBot } from "./bot";

async function bootstrap(): Promise<void> {
  const container = await buildBot(appConfig);
  const { bot, dispose } = container;

  try {
    await bot.api.deleteWebhook({ drop_pending_updates: true });
  } catch (error) {
    await dispose();
    throw error;
  }

  const stop = async () => {
    try {
      bot.stop();
    } finally {
      await dispose();
    }
  };

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  bot
    .start({
      drop_pending_updates: true,
      allowed_updates: ["message", "callback_query"],
    })
    .catch(async (error) => {
      console.error("Failed to start bot", error);
      await dispose();
    });
}

bootstrap().catch((error) => {
  console.error("Fatal startup error", error);
  process.exitCode = 1;
});

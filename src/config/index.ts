import { config as loadEnv } from "dotenv";

loadEnv();

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN is not set");
}

const REQUIRED_CHANNEL_ID = process.env.REQUIRED_CHANNEL_ID ?? "";

const ADMIN_IDS = (process.env.ADMIN_IDS ?? "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean)
  .map((value) => Number.parseInt(value, 10))
  .filter((value) => Number.isInteger(value));

export interface AppConfig {
  botToken: string;
  redisUrl: string;
  requiredChannelId: string;
  adminIds: number[];
  captchaRetries: number;
}

export const appConfig: AppConfig = {
  botToken: BOT_TOKEN,
  redisUrl: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  requiredChannelId: REQUIRED_CHANNEL_ID,
  adminIds: ADMIN_IDS,
  captchaRetries: (() => {
    const value = Number.parseInt(process.env.CAPTCHA_RETRIES ?? "3", 10);
    return Number.isSafeInteger(value) && value > 0 ? value : 3;
  })(),
};

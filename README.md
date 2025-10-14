# Project Quest Bot

## Overview
Project Quest Bot orchestrates an automated giveaway and quest experience that spans both Telegram and Discord. The Node.js application boots a Telegram bot, keeps quest state in Redis, and exposes a Discord verifier that listens for `!verify` commands so community members can link their Discord and Telegram identities.

## Key Capabilities
- **Telegram automation** – `src/main.ts` loads the `BotApplication`, registers handlers, and starts the Telegram bot once supporting services are ready.
- **Discord verification** – `src/discord/index.ts` logs a privileged Discord client in order to validate guild membership and confirm quests triggered through the `!verify` command.
- **Quest progress tracking** – Redis-backed repositories under `src/services` persist quest status and contact information so the bot can respond to `/status` style requests consistently.

## Prerequisites
- Node.js 20+
- Yarn or npm for dependency management
- Access to a Redis instance

## Configuration
Create a `.env` file or export environment variables before running the bot. The configuration loader (`src/config/index.ts`) expects the following keys:

| Variable | Purpose |
| --- | --- |
| `BOT_TOKEN` | Telegram bot token used to authenticate with the Bot API. |
| `REDIS_URL` | Connection string for the Redis instance that stores quest data. |
| `ADMIN_IDS` | Comma-separated list of Telegram user IDs with elevated privileges. |
| `CAPTCHA_RETRIES` | Optional override for how many attempts are allowed when solving captchas. |
| `TELEGRAM_CHANNEL_ID` / `TELEGRAM_CHANNEL_URL` | Identifiers for the announcement channel. |
| `TELEGRAM_CHAT_ID` / `TELEGRAM_CHAT_URL` | Identifiers for the discussion chat. |
| `X_PROFILE_URL`, `INSTAGRAM_PROFILE_URL`, `WEBSITE_URL`, `DISCORD_INVITE_URL` | Links surfaced inside bot replies. |
| `DISCORD_GUILD_ID`, `DISCORD_CHANNEL_ID`, `DISCORD_BOT_TOKEN` | Credentials for the Discord verifier. |

## Local Development
```bash
yarn install
# start the Telegram bot and Discord verifier with live TypeScript execution
yarn dev

# or build compiled JavaScript and run it
yarn build
yarn start
```

The build step compiles TypeScript to `dist/` and copies the Instagram/X automation scripts that ship with the project (`src/x_ig_scripts/*.json`).

## FAQ
**Will running the project here modify the upstream remote automatically?** No. Work performed in this environment only changes the local repository clone. You must push commits to the remote yourself if you want those updates to appear upstream.

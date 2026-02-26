import type { Context, SessionFlavor } from "grammy";

export interface BotSessionData {
	lastCommandAt: string | null;
}

export type BotContext = Context & SessionFlavor<BotSessionData>;

export interface TelegramCommandHandler {
	readonly command: string;
	execute(ctx: BotContext): Promise<void>;
}

import type { Context, SessionFlavor } from "grammy";

export interface TelegramSessionData {
	lastCommandAt: string | null;
}

export type TelegramBotContext = Context & SessionFlavor<TelegramSessionData>;

export interface TelegramCommandHandler {
	readonly command: string;
	execute(ctx: TelegramBotContext): Promise<void>;
}

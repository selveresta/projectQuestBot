import type { Context, SessionFlavor } from "grammy";

export interface TelegramSessionData {
	lastCommandAt: string | null;
}

export type TelegramBotContext = Context & SessionFlavor<TelegramSessionData>;

export type TelegramCommandAccess = "public" | "admin";

export interface TelegramCommandHandler {
	readonly command: string;
	readonly description?: string;
	readonly access?: TelegramCommandAccess;
	readonly requiresIdentity?: boolean;
	readonly featureFlag?: string;
	execute(ctx: TelegramBotContext): Promise<void>;
}

export interface TelegramPolicyHookContext {
	ctx: TelegramBotContext;
	command: TelegramCommandHandler;
}

export interface TelegramPolicyDecision {
	allowed: boolean;
	reason?: string;
	replyMessage?: string;
}

export interface TelegramPolicyHook {
	readonly name: string;
	evaluate(input: TelegramPolicyHookContext): Promise<TelegramPolicyDecision>;
}

export interface TelegramCommandLifecycleEvent {
	command: string;
	updateId: number;
	telegramId?: number;
}

export interface TelegramEventHook {
	onCommandReceived?(event: TelegramCommandLifecycleEvent): Promise<void>;
	onCommandSucceeded?(event: TelegramCommandLifecycleEvent): Promise<void>;
	onCommandFailed?(event: TelegramCommandLifecycleEvent & { error: Error }): Promise<void>;
}

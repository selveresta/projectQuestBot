import { Composer, InlineKeyboard } from "grammy";

import type { BotContext } from "../../types/context";
import type { QuestId } from "../../types/quest";
import type { QuestStatus } from "../../services/questService";
import { getExistingSocialUrl, isSocialQuestId, ensureSocialBaseline } from "../helpers/socialQuests";
import { TelegramMembershipVerifier } from "../helpers/membership";
import {
	BUTTON_BACK_TO_MENU,
	BUTTON_CHECK_STATUS,
	BUTTON_QUEST_LIST,
	MENU_PLACEHOLDER_TEXT,
	buildMainMenuKeyboard,
} from "../ui/replyKeyboards";
import { promptForContact } from "./contact";

const QUEST_BUTTON_PREFIXES = ["✅", "⏳"] as const;

export class QuestListHandler {
	register(composer: Composer<BotContext>): void {
		composer.hears(BUTTON_QUEST_LIST, this.handleOpenList.bind(this));
		composer.hears(BUTTON_BACK_TO_MENU, this.handleBackToMenu.bind(this));
		composer.on("message:text", this.handleQuestSelection.bind(this));
		composer.callbackQuery(/^quest-open:(.+)$/, this.handleQuestOpen.bind(this));
		composer.callbackQuery(/^quest-check:(.+)$/, this.handleCheckRequest.bind(this));
	}

	private async handleOpenList(ctx: BotContext): Promise<void> {
		if (!ctx.from) {
			await ctx.reply("I need a Telegram user to show quests.");
			return;
		}

		await this.sendQuestList(ctx, ctx.from.id);
	}

	private async handleBackToMenu(ctx: BotContext): Promise<void> {
		await ctx.reply(MENU_PLACEHOLDER_TEXT, {
			reply_markup: buildMainMenuKeyboard(ctx.config, ctx.chatId),
			link_preview_options: { is_disabled: true },
		});
	}

	private async handleQuestSelection(ctx: BotContext, next: () => Promise<void>): Promise<void> {
		if (!ctx.from) {
			await next();
			return;
		}

		const text = ctx.message?.text;
		const questTitle = text ? this.extractQuestTitle(text) : undefined;
		if (!questTitle) {
			await next();
			return;
		}

		const userId = ctx.from.id;
		const questService = ctx.services.questService;
		const statuses = await questService.buildQuestStatus(userId);
		const target = statuses.find((status) => status.definition.title === questTitle);
		if (!target) {
			await next();
			return;
		}
		if (!this.shouldDisplay(target)) {
			await next();
			return;
		}

		const user = await questService.getUser(userId);
		const existingSocialUrl = isSocialQuestId(target.definition.id) ? getExistingSocialUrl(user, target.definition.id) : undefined;
		if (!existingSocialUrl && isSocialQuestId(target.definition.id)) {
			await ctx.reply("📸 Share your profile link. \n Return to the main menu and use Set Instagram/X button.");
			return;
		}

		await this.sendQuestDetail(ctx, userId, target);
	}

	private async handleQuestOpen(ctx: BotContext): Promise<void> {
		const questId = ctx.match?.[1] as QuestId | undefined;
		if (!questId) {
			await ctx.answerCallbackQuery({ text: "Unknown quest." });
			return;
		}

		const userId = ctx.from?.id;
		if (!userId) {
			await ctx.answerCallbackQuery({ text: "Telegram user required.", show_alert: true });
			return;
		}

		const questService = ctx.services.questService;
		const statuses = await questService.buildQuestStatus(userId);
		const target = statuses.find((status) => status.definition.id === questId);
		if (!target || !this.shouldDisplay(target)) {
			await ctx.answerCallbackQuery({ text: "Quest not available.", show_alert: true });
			return;
		}

		const user = await questService.getUser(userId);
		const existingSocialUrl = isSocialQuestId(target.definition.id) ? getExistingSocialUrl(user, target.definition.id) : undefined;
		if (!existingSocialUrl && isSocialQuestId(target.definition.id)) {
			await ctx.reply("📸 Share your profile link. \n Use Set Instagram/X button.");
			await ctx.answerCallbackQuery({ text: target.definition.title });
			return;
		}

		await ctx.answerCallbackQuery({ text: target.definition.title });
		await this.sendQuestDetail(ctx, userId, target);
	}

	private async sendQuestList(ctx: BotContext, userId: number): Promise<void> {
		const questService = ctx.services.questService;
		const statuses = await questService.buildQuestStatus(userId);
		const visibleStatuses = statuses.filter((status) => this.shouldDisplay(status));

		const completedCount = statuses.filter((status) => status.completed).length;
		const total = statuses.length;

		const keyboard = this.buildQuestListKeyboard(visibleStatuses);

		await ctx.reply(
			[
				"📋 Quest list",
				`Progress: ${completedCount}/${total} quests completed.`,
				"Choose a quest below to view details or mark it as complete.",
			].join("\n"),
			{ reply_markup: keyboard }
		);
	}

	private async sendQuestDetail(ctx: BotContext, userId: number, status: QuestStatus): Promise<void> {
		if (status.completed) {
			await ctx.reply("✅ Quest completed, let's start to complete other", {
				reply_markup: buildMainMenuKeyboard(ctx.config, ctx.chatId),
			});
			return;
		}
		const questService = ctx.services.questService;
		const { definition } = status;
		const user = await questService.getUser(userId);
		const existingSocialUrl = isSocialQuestId(definition.id) ? getExistingSocialUrl(user, definition.id) : undefined;

		if (isSocialQuestId(definition.id) && existingSocialUrl) {
			void ensureSocialBaseline(ctx, userId, definition.id, existingSocialUrl).catch((error) => {
				console.error("[questList] failed to ensure social baseline", {
					userId,
					questId: definition.id,
					error,
				});
			});
		}
		const title = (id: QuestId) =>
			`${status.completed ? "✅" : "⏳"} ${id === "discord_join" ? `**${definition.title}**` : `<b>${definition.title}</b>`} `;
		const lines = [
			title(definition.id),
			"",
			definition.description,
			"",
			status.completed ? `Status: Completed${status.completedAt ? ` at ${status.completedAt}` : ""}.` : "Status: Pending completion.",
		];

		if (existingSocialUrl && definition.id !== "discord_join") {
			lines.push(`Stored profile: ${existingSocialUrl}`);
		} else if (status.metadata) {
			lines.push(`Submission: ${status.metadata}`);
		}

		if (definition.url) {
			lines.push(`Official link: ${definition.url}`);
		}

		if (definition.id === "email_submit") {
			lines.push("", "✉️ Reply to this message with the email you want to use for the giveaway.");
		}

		if (definition.id === "discord_join") {
			const inviteLink = ctx.config.links.discordInviteUrl;
			// if (user.discordUserId) {
			// 	lines.push("", `Linked Discord ID: ${user.discordUserId}`);
			// }
			lines.push(
				"Discord verification steps:",
				"",
				inviteLink ? `1. Join the server: ${inviteLink}` : "1. Join the Discord server.",
				"2. Complete the initial user verification to unlock access.",
				"3. Go to #🎁▪️giveaway-verification channel.",
				`4. Send the command: \`!verify ${userId}\``,
				"5. Wait for the bot to confirm your verification here."
			);
		}

		lines.push("", 'Tip: tap "🗂 Quest list" in the menu to switch quests.');

		const keyboard = this.buildQuestDetailKeyboard(status, existingSocialUrl);

		await ctx.reply(lines.join("\n"), {
			reply_markup: keyboard,
			parse_mode: definition.id === "discord_join" ? "Markdown" : "HTML",
			link_preview_options: { is_disabled: true },
		});

		if (definition.id === "email_submit") {
			const existingEmail = user.email ?? status.metadata ?? undefined;
			await promptForContact(ctx, "email", existingEmail);
		}
		if (definition.id === "wallet_submit") {
			const existingWallet = user.wallet ?? status.metadata ?? undefined;
			await promptForContact(ctx, "wallet", existingWallet);
		}
		if (definition.id === "sol_wallet_submit") {
			const existingWallet = user.solanaWallet ?? status.metadata ?? undefined;
			await promptForContact(ctx, "sol_wallet", existingWallet);
		}
	}

	private buildQuestListKeyboard(statuses: QuestStatus[]): InlineKeyboard {
		const keyboard = new InlineKeyboard();
		statuses.forEach((status, index) => {
			keyboard.text(this.questButtonLabel(status), `quest-open:${status.definition.id}`);
			keyboard.row();
		});
		return keyboard;
	}

	private buildQuestDetailKeyboard(status: QuestStatus, existingSocialUrl?: string): InlineKeyboard {
		const { definition } = status;
		const keyboard = new InlineKeyboard();
		const socialQuest = isSocialQuestId(definition.id);

		const addOfficialLink = (): boolean => {
			if (definition.url) {
				keyboard.url(definition.cta ?? "Open link", definition.url);
				return true;
			}
			return false;
		};

		switch (definition.id) {
			case "telegram_channel": {
				const hasButton = addOfficialLink();
				if (hasButton) {
					keyboard.row();
				}
				keyboard.text("Check channel membership", "quest-check:telegram_channel");
				break;
			}
			case "telegram_chat": {
				const hasButton = addOfficialLink();
				if (hasButton) {
					keyboard.row();
				}
				keyboard.text("Check chat membership", "quest-check:telegram_chat");
				break;
			}
			case "discord_join": {
				const hasButton = addOfficialLink();
				if (hasButton) {
					keyboard.row();
				}
				break;
			}
			default: {
				const hadLink = addOfficialLink();
				if (socialQuest) {
					if (existingSocialUrl) {
						if (hadLink) {
							keyboard.row();
						}
						keyboard.row();
						keyboard.text("✅ Verify", `quest:${definition.id}:verify`);
					} else {
						if (hadLink) {
							keyboard.row();
						}
						keyboard.text("Submit profile link", `quest:${definition.id}:complete`);
					}
				} else if (!status.completed && definition.phase === "stub") {
					if (hadLink) {
						keyboard.row();
					}
					keyboard.text("Mark as complete", `quest:${definition.id}:complete`);
				}
			}
		}

		return keyboard;
	}

	private shouldDisplay(status: QuestStatus): boolean {
		if (isSocialQuestId(status.definition.id) && !status.definition.url) {
			return false;
		}
		return true;
	}

	private questButtonLabel(status: QuestStatus): string {
		const prefix = status.completed ? "✅" : "⏳";
		return `${prefix} ${status.definition.title}`;
	}

	private extractQuestTitle(text: string): string | undefined {
		if (!QUEST_BUTTON_PREFIXES.some((prefix) => text.startsWith(prefix))) {
			return undefined;
		}
		return text.replace(/^[^\s]+\s+/, "").trim() || undefined;
	}

	private async handleCheckRequest(ctx: BotContext): Promise<void> {
		const questId = ctx.match?.[1] as QuestId | undefined;
		if (!questId) {
			await ctx.answerCallbackQuery({ text: "Unknown quest." });
			return;
		}

		const userId = ctx.from?.id;
		if (!userId) {
			await ctx.answerCallbackQuery({ text: "Telegram user required.", show_alert: true });
			return;
		}

		if (questId === "telegram_channel" || questId === "telegram_chat") {
			const target = questId === "telegram_channel" ? "channel" : "chat";
			const ok = await TelegramMembershipVerifier.ensure(ctx, target);
			await ctx.answerCallbackQuery({ text: ok ? "Membership checked." : "See messages for details." });
			return;
		}

		if (questId === "discord_join") {
			const completed = await ctx.services.questService.hasCompletedQuest(userId, "discord_join");
			await ctx.answerCallbackQuery({
				text: completed ? "Discord verification already recorded." : "Still waiting for Discord verification.",
				show_alert: !completed,
			});
			return;
		}

		await ctx.answerCallbackQuery({ text: "Unsupported quest." });
	}
}

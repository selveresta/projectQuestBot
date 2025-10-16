import { Composer, InputFile, Keyboard } from "grammy";

import type { BotContext } from "../../../types/context";
import {
	buildAdminKeyboard,
	buildMainMenuKeyboard,
	BUTTON_ADMIN_DASHBOARD,
	BUTTON_ADMIN_DOWNLOAD,
	BUTTON_ADMIN_PANEL,
	BUTTON_BACK_TO_MENU,
	MENU_PLACEHOLDER_TEXT,
} from "../../ui/replyKeyboards";
import { QuestDefinition } from "../../../types/quest";
import { UserRecord } from "../../../types/user";

export class AdminCommandHandler {
	register(composer: Composer<BotContext>): void {
		// entry points
		composer.command("admin", this.handleAdminPanel.bind(this));
		composer.hears(BUTTON_ADMIN_PANEL, this.handleAdminPanel.bind(this));

		// admin UI actions
		composer.hears(BUTTON_ADMIN_DASHBOARD, this.handleDashboard.bind(this));
		composer.hears(BUTTON_ADMIN_DOWNLOAD, this.handleDownloadUsers.bind(this));

		// fallback aliases (як у твоєму прикладі)
		composer.hears("ADMIN PANEL", this.handleAdminPanel.bind(this));
		composer.hears("DASHBOARD", this.handleDashboard.bind(this));
		composer.hears("DOWNLOAD USER", this.handleDownloadUsers.bind(this));

		// back to main menu
		composer.hears(BUTTON_BACK_TO_MENU, this.handleBackToMainMenu.bind(this));
	}

	// Показати адмін-меню з кнопками
	private async handleAdminPanel(ctx: BotContext): Promise<void> {
		if (!this.assertAdmin(ctx)) return;

		await ctx.reply("Welcome to the Admin panel.\nChoose an action:", { reply_markup: buildAdminKeyboard(), parse_mode: "HTML" });
	}

	// Безпека: перевірка, що користувач — адмін
	private assertAdmin(ctx: BotContext): boolean {
		const userId = ctx.from?.id;
		if (!userId || !ctx.config.adminIds.includes(userId)) {
			ctx.reply("This command is restricted to admins.");
			return false;
		}
		return true;
	}

	private flattenUsersToCsv(users: UserRecord[], questDefs: QuestDefinition[]): { filename: string; csv: string } {
		// Заголовок: базові поля + по 3 колонки на кожен квест
		const baseCols = [
			"userId",
			"username",
			"firstName",
			"lastName",
			"captchaPassed",
			"captchaAttempts",
			"email",
			"wallet",
			"solanaWallet",
			"xProfileUrl",
			"instagramProfileUrl",
			"discordUserId",
			"points",
			"referralsCount",
			"referredBy",
			"createdAt",
			"updatedAt",
			"eligible",
		];

		const questCols: string[] = [];
		for (const q of questDefs) {
			questCols.push(`quest:${q.id}`, `completedAt:${q.id}`, `meta:${q.id}`);
		}

		const header = [...baseCols, ...questCols];

		// Рядки
		const rows: string[] = [];
		rows.push(header.map(this.csvEscape).join(","));

		for (const u of users) {
			const line: (string | number | boolean | null | undefined)[] = [];

			// базові поля
			line.push(
				u.userId,
				u.username ?? "",
				u.firstName ?? "",
				u.lastName ?? "",
				u.captchaPassed,
				u.captchaAttempts,
				u.email ?? "",
				u.wallet ?? "",
				u.solanaWallet ?? "",
				u.xProfileUrl ?? "",
				u.instagramProfileUrl ?? "",
				u.discordUserId ?? "",
				u.points ?? 0,
				u.creditedReferrals?.length ?? 0,
				u.referredBy ?? "",
				u.createdAt,
				u.updatedAt,
				// eligible — розраховуємо як: капча пройдена + всі обов'язкові квести виконані
				// (на випадок, якщо сервіс уже має метод — краще використовувати його; тут — локальна оцінка)
				null // тимчасово, нижче перезапишемо
			);

			// тимчасово додали null, тепер порахуємо eligible
			const mandatoryAllDone = questDefs.filter((q) => q.mandatory).every((q) => u.quests?.[q.id]?.completed === true);
			const eligible = u.captchaPassed && mandatoryAllDone;
			line[line.length - 1] = eligible;

			// квести
			for (const q of questDefs) {
				const entry = u.quests?.[q.id];
				line.push(entry?.completed ?? false, entry?.completedAt ?? "", entry?.metadata ?? "");
			}

			rows.push(line.map(this.csvEscape).join(","));
		}

		const csv = rows.join("\n");
		const filename = `users_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
		return { filename, csv };
	}

	// Гарний формат дашборду
	private formatAdminDashboard(params: {
		totalUsers: number;
		captchaPassed: number;
		eligibleCount: number;
		questDefs: QuestDefinition[];
		users: UserRecord[];
	}): string {
		const { totalUsers, captchaPassed, eligibleCount, questDefs, users } = params;

		// Статистика по кожному квесту: скільки виконали
		const perQuestCounts = questDefs.map((q) => {
			const done = users.reduce((acc, u) => acc + (u.quests?.[q.id]?.completed ? 1 : 0), 0);
			return { id: q.id, title: q.title, done };
		});

		const lines: string[] = [];
		lines.push("🛠 <b>Admin Dashboard</b>");
		lines.push("");
		lines.push(`👥 <b>Total users:</b> ${totalUsers}`);
		lines.push(`🛡️ <b>Captcha passed:</b> ${captchaPassed}`);
		lines.push(`🎟 <b>Eligible for giveaway:</b> ${eligibleCount}`);
		lines.push("");
		lines.push("📌 <b>Quests completion:</b>");

		for (const qc of perQuestCounts) {
			lines.push(`• <b>${qc.title}</b> — ${qc.done} users`);
		}

		return lines.join("\n");
	}

	// CSV: екранування значень (RFC4180-friendly)
	private csvEscape(v: unknown): string {
		if (v === null || v === undefined) return "";
		const s = String(v);
		if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
		return s;
	}

	private buildPointsEntryCsv(users: UserRecord[]): { filename: string; csv: string } {
		const rows: string[] = [];
		rows.push("username,id");

		for (const user of users) {
			const rawPoints = typeof user.points === "number" ? user.points : Number(user.points ?? 0);
			const points = Number.isFinite(rawPoints) ? Math.max(0, Math.floor(rawPoints)) : 0;
			if (points <= 0) {
				continue;
			}
			const username = user.username ? `@${user.username}` : "";
			const escapedUsername = this.csvEscape(username);
			const escapedId = this.csvEscape(user.userId);
			for (let index = 0; index < points; index += 1) {
				rows.push(`${escapedUsername},${escapedId}`);
			}
		}

		if (rows.length === 1) {
			rows.push("# No users with positive points found,#");
		}

		const csv = rows.join("\n");
		const filename = `points_entries_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
		return { filename, csv };
	}

	// Красиве представлення дашборду (перероблений handleAdminDashboard)
	private async handleDashboard(ctx: BotContext): Promise<void> {
		if (!this.assertAdmin(ctx)) return;

		const repo = ctx.services.userRepository;
		const questService = ctx.services.questService;

		const [users, eligibleCount, questDefs] = await Promise.all([
			repo.listAllUsers(),
			questService.countEligibleParticipants(),
			questService.getDefinitions(),
		]);

		const captchaPassed = users.filter((u) => u.captchaPassed).length;

		const html = this.formatAdminDashboard({
			totalUsers: users.length,
			captchaPassed,
			eligibleCount,
			questDefs,
			users,
		});

		await ctx.reply(html, { parse_mode: "HTML", reply_markup: buildAdminKeyboard() });
	}

	// Згенерувати CSV з користувачами та їх прогресом і відправити файлом
	private async handleDownloadUsers(ctx: BotContext): Promise<void> {
		if (!this.assertAdmin(ctx)) return;

		const repo = ctx.services.userRepository;
		const questService = ctx.services.questService;

		const [users, questDefs] = await Promise.all([repo.listAllUsers(), questService.getDefinitions()]);

		// Якщо сервіс не повертає дефініції — беремо ключі з першого користувача
		const effectiveQuestDefs =
			Array.isArray(questDefs) && questDefs.length > 0
				? questDefs
				: Object.keys(users[0]?.quests ?? {}).map((id) => ({
						id: id as any,
						title: id,
						description: "",
						mandatory: true,
						type: "social_follow",
						phase: "live",
				  }));

		const { filename, csv } = this.flattenUsersToCsv(users, effectiveQuestDefs as any);
		const pointsCsv = this.buildPointsEntryCsv(users);

		await ctx.replyWithDocument(new InputFile(Buffer.from(csv, "utf8"), filename), {
			caption: "Exported users with quest progress (CSV).",
			reply_markup: buildAdminKeyboard(),
		});

		await ctx.replyWithDocument(new InputFile(Buffer.from(pointsCsv.csv, "utf8"), pointsCsv.filename), {
			caption: "Points entries (one line per point).",
			reply_markup: buildAdminKeyboard(),
		});
	}

	// Повернення в головне меню (використай свою вже існуючу реалізацію)
	private async handleBackToMainMenu(ctx: BotContext): Promise<void> {
		// Припустимо, що у тебе вже є builder головного меню:
		// import { buildMainMenuMessage, buildMainMenuKeyboard } from "...";

		const kb = buildMainMenuKeyboard(ctx.config, ctx.chatId);

		await ctx.reply(MENU_PLACEHOLDER_TEXT, {
			reply_markup: kb,
			link_preview_options: { is_disabled: true },
		});
	}
}

import { Composer, InputFile } from "grammy";

import type { BotContext } from "../../../types/context";
import {
	buildAdminKeyboard,
	buildMainMenuKeyboard,
	BUTTON_ADMIN_DASHBOARD,
	BUTTON_ADMIN_DOWNLOAD,
	BUTTON_ADMIN_NOTIFY_SELF,
	BUTTON_ADMIN_NOTIFY_USERS,
	BUTTON_ADMIN_RECALCULATE_REFERRALS,
	BUTTON_ADMIN_PANEL,
	BUTTON_BACK_TO_MENU,
	MENU_PLACEHOLDER_TEXT,
} from "../../ui/replyKeyboards";
import { QuestDefinition } from "../../../types/quest";
import { UserRecord } from "../../../types/user";
import type { ReferralRecalculationSummary } from "../../../services/userRepository";

const BROADCAST_MESSAGE = `
The giveaway officially ends on November 17, when we’ll distribute all rewards to the winners.

⚠️Important:
Make sure you’re still subscribed to all Trady social channels (X, Instagram, Discord, Telegram Channel & Chat).
Unsubscribed users won’t be counted in the final prize distribution.`;

const BROADCAST_BATCH_SIZE = 20;
const BROADCAST_DELAY_MS = 1100;
interface BroadcastJob {
	startedAt: number;
	startedBy?: number;
	totalUsers: number;
	progress: {
		sent: number;
		failed: number;
	};
}
export class AdminCommandHandler {
	private broadcastJob: BroadcastJob | null = null;

	register(composer: Composer<BotContext>): void {
		// entry points
		composer.command("admin", this.handleAdminPanel.bind(this));
		composer.hears(BUTTON_ADMIN_PANEL, this.handleAdminPanel.bind(this));

		// admin UI actions
		composer.hears(BUTTON_ADMIN_DASHBOARD, this.handleDashboard.bind(this));
		composer.hears(BUTTON_ADMIN_DOWNLOAD, this.handleDownloadUsers.bind(this));
		composer.hears(BUTTON_ADMIN_NOTIFY_USERS, this.handleNotifyUsers.bind(this));
		// composer.hears(BUTTON_ADMIN_NOTIFY_SELF, this.handleNotifyAdminPreview.bind(this));
		composer.hears(BUTTON_ADMIN_RECALCULATE_REFERRALS, this.handleRecalculateReferrals.bind(this));

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

	private formatReferralRecalculationResult(summary: ReferralRecalculationSummary): string {
		const netPoints = summary.pointsAdjustment;
		const formattedNet = `${netPoints >= 0 ? "+" : ""}${netPoints}`;
		const parts: string[] = [
			"♻️ <b>Referral recalculation complete.</b>",
			`• Users processed: ${summary.totalUsers}`,
			`• Referrers adjusted: ${summary.referrersAdjusted}`,
			`• Referral claims reset: ${summary.referralClaimsReset}`,
			`• Credits removed: ${summary.removedCreditedReferrals}`,
			`• Net point change: ${formattedNet}`,
		];
		return parts.join("\n");
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

	private async handleRecalculateReferrals(ctx: BotContext): Promise<void> {
		if (!this.assertAdmin(ctx)) return;

		await ctx.reply("Starting referral recalculation…", {
			reply_markup: buildAdminKeyboard(),
		});

		try {
			const summary = await ctx.services.questService.recalculateReferralBonuses();
			const response = this.formatReferralRecalculationResult(summary);
			await ctx.reply(response, { parse_mode: "HTML", reply_markup: buildAdminKeyboard() });
		} catch (error) {
			console.error("[adminReferralRecalc] failed to recalculate referrals", { error });
			await ctx.reply("Failed to recalculate referral points. Check logs for more details.", {
				reply_markup: buildAdminKeyboard(),
			});
		}
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

	private async handleNotifyAdminPreview(ctx: BotContext): Promise<void> {
		if (!this.assertAdmin(ctx)) return;

		if (this.broadcastJob) {
			await ctx.reply(this.describeBroadcastJob(this.broadcastJob), { reply_markup: buildAdminKeyboard() });
			return;
		}

		const adminChatId = ctx.chat?.id ?? ctx.from?.id;
		if (!adminChatId) {
			await ctx.reply("Cannot determine where to send the preview. Try again from a private chat.", {
				reply_markup: buildAdminKeyboard(),
			});
			return;
		}

		const previewUsers = this.buildPreviewBroadcastUsers(adminChatId, 10);
		await ctx.reply(
			[
				`Preview broadcast queued with ${previewUsers.length} delivery attempts.`,
				"You will receive every message yourself to mimic the full job.",
			].join(" "),
			{ reply_markup: buildAdminKeyboard() }
		);

		this.startBroadcastJob(ctx, previewUsers, adminChatId);
	}

	private async handleNotifyUsers(ctx: BotContext): Promise<void> {
		if (!this.assertAdmin(ctx)) return;

		if (this.broadcastJob) {
			await ctx.reply(this.describeBroadcastJob(this.broadcastJob), {
				reply_markup: buildAdminKeyboard(),
			});
			return;
		}

		const repo = ctx.services.userRepository;
		const users = await repo.listAllUsers();

		if (users.length === 0) {
			await ctx.reply("There are no users stored yet.", { reply_markup: buildAdminKeyboard() });
			return;
		}

		const adminChatId = ctx.chat?.id ?? ctx.from?.id;
		if (!adminChatId) {
			await ctx.reply("Cannot determine where to send broadcast status updates. Try again from a private chat.", {
				reply_markup: buildAdminKeyboard(),
			});
			return;
		}

		await ctx.reply(
			[
				`Broadcast queued for ${users.length} user${users.length === 1 ? "" : "s"}.`,
				"You will get progress updates here while it runs in the background.",
			].join(" "),
			{ reply_markup: buildAdminKeyboard() }
		);

		this.startBroadcastJob(ctx, users, adminChatId);
	}


	private startBroadcastJob(ctx: BotContext, users: UserRecord[], adminChatId: number): void {
		const job: BroadcastJob = {
			startedAt: Date.now(),
			startedBy: ctx.from?.id,
			totalUsers: users.length,
			progress: {
				sent: 0,
				failed: 0,
			},
		};

		const task = this.runBroadcastJob(job, users, ctx, adminChatId);
		this.broadcastJob = job;

		void task
			.then((summary) => {
				const message = this.formatBroadcastSummary(summary);
				return this.safeNotifyAdmin(ctx, adminChatId, message);
			})
			.catch((error) => {
				console.error("[adminBroadcast] job failed", { error });
				return this.safeNotifyAdmin(ctx, adminChatId, "Broadcast failed. Check logs for details.");
			})
			.finally(() => {
				if (this.broadcastJob === job) {
					this.broadcastJob = null;
				}
			});
	}

	private async runBroadcastJob(
		job: BroadcastJob,
		users: UserRecord[],
		ctx: BotContext,
		adminChatId: number
	): Promise<{ sent: number; failed: number }> {
		for (let index = 0; index < users.length; index += 1) {
			const user = users[index];
			try {
				await ctx.api.sendMessage(user.userId, BROADCAST_MESSAGE);
				job.progress.sent += 1;
			} catch (error) {
				job.progress.failed += 1;
				console.error("[adminBroadcast] failed to send message", { userId: user.userId, error });
			}

			const delivered = index + 1;
			const needsPause = delivered % BROADCAST_BATCH_SIZE === 0 && delivered < users.length;
			if (needsPause) {
				await this.safeNotifyAdmin(
					ctx,
					adminChatId,
					this.formatBroadcastProgress(job.progress.sent, job.progress.failed, users.length)
				);
				await delay(BROADCAST_DELAY_MS);
			}
		}

		return { sent: job.progress.sent, failed: job.progress.failed };
	}

	private describeBroadcastJob(job: BroadcastJob): string {
		const elapsedSeconds = Math.floor((Date.now() - job.startedAt) / 1000);
		const pending = Math.max(job.totalUsers - (job.progress.sent + job.progress.failed), 0);
		const startedBy = job.startedBy ? ` by admin ${job.startedBy}` : "";
		return [
			`Broadcast already running${startedBy}.`,
			this.formatBroadcastProgress(job.progress.sent, job.progress.failed, job.totalUsers),
			`Elapsed: ${elapsedSeconds}s.`,
			pending === 0 ? "" : `${pending} user${pending === 1 ? "" : "s"} remaining.`,
		]
			.filter(Boolean)
			.join(" ");
	}

	private formatBroadcastProgress(sent: number, failed: number, total: number): string {
		return `Progress: ${sent}/${total} delivered${failed > 0 ? `, ${failed} failed` : ""}.`;
	}

	private formatBroadcastSummary(summary: { sent: number; failed: number }): string {
		const parts = [`Broadcast complete. Delivered to ${summary.sent} user${summary.sent === 1 ? "" : "s"}.`];
		if (summary.failed > 0) {
			parts.push(`${summary.failed} send${summary.failed === 1 ? "" : "s"} failed.`);
		}
		return parts.join(" ");
	}

	private async safeNotifyAdmin(ctx: BotContext, adminChatId: number, message: string): Promise<void> {
		try {
			await ctx.api.sendMessage(adminChatId, message, {
				reply_markup: buildAdminKeyboard(),
				link_preview_options: { is_disabled: true },
			});
		} catch (error) {
			console.error("[adminBroadcast] failed to notify admin", { adminChatId, error });
		}
	}

	private buildPreviewBroadcastUsers(adminId: number, count: number): UserRecord[] {
		const timestamp = new Date().toISOString();
		return Array.from({ length: count }, () => ({
			userId: adminId,
			username: undefined,
			firstName: undefined,
			lastName: undefined,
			captchaPassed: true,
			captchaAttempts: 0,
			pendingCaptcha: null,
			quests: {} as UserRecord["quests"],
			points: 0,
			questPoints: {},
			referredBy: undefined,
			referralBonusClaimed: false,
			creditedReferrals: [],
			email: undefined,
			wallet: undefined,
			solanaWallet: undefined,
			xProfileUrl: undefined,
			instagramProfileUrl: undefined,
			discordUserId: undefined,
			createdAt: timestamp,
			updatedAt: timestamp,
		}));
	}
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

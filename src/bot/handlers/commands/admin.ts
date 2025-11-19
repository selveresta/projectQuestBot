import { Composer, InputFile } from "grammy";

import type { BotContext } from "../../../types/context";
import {
	buildAdminKeyboard,
	buildMainMenuKeyboard,
	BUTTON_ADMIN_DASHBOARD,
	BUTTON_ADMIN_DOWNLOAD,
	BUTTON_ADMIN_DOWNLOAD_WINNERS,
	BUTTON_ADMIN_NOTIFY_SELF,
	BUTTON_ADMIN_NOTIFY_USERS,
	BUTTON_ADMIN_NOTIFY_WINNERS,
	BUTTON_ADMIN_PANEL,
	BUTTON_BACK_TO_MENU,
	MENU_PLACEHOLDER_TEXT,
} from "../../ui/replyKeyboards";
import { QuestDefinition } from "../../../types/quest";
import { UserRecord } from "../../../types/user";
import type { ReferralRecalculationSummary } from "../../../services/userRepository";
import type { WinnerRecord } from "../../../types/winner";
import { buildWinnerPromptMessage, createWinnerConfirmationKeyboard, WINNER_LOCK_MESSAGE } from "../winnerFlow";

const BROADCAST_MESSAGE = `
The giveaway has officially ended and all rewards were distributed yesterday.
Here are the Top 10 winners from the leaderboard:

@Rocky5800
@RubelDewan10
@Rohyus
@Cahya_media
@Mr_FreeMan02
@Titinbadriyah
@bigcryptoproject
@mdabubakker11
@a999901jjja
@Yeasin_Sheikh

Stay alert — a major announcement is coming soon.
We’re preparing to reveal the Trady release details — and members of this giveaway will get a unique chance to join the platform among the first and participate in early incentive activities reserved only for early entrants.

📅 Mark the date: December 1 — this is when Early Access officially launches.
And pay close attention to our bot — only there we will drop a huge exclusive offer for early adopters.
Don’t miss out — being early will matter here.`;
const BROADCAST_BATCH_SIZE = 29;
const BROADCAST_DELAY_MS = 1000;

type BroadcastJob = {
	startedAt: number;
	startedBy?: number;
	totalUsers: number;
	progress: {
		sent: number;
		failed: number;
	};
};

export const SELECTED_WINNER_IDS: number[] = [
	513284964, 1302902094, 7365118678, 5224381228, 1231751391, 6956064679, 1238662534, 1621467058, 6088808135, 1236573305, 6707849504,
	687610344, 1359095406, 1055544063, 5999803625, 5462769788, 6708650445, 6053050854, 7400298705, 1297389573, 6301237469, 6235803692,
	6341709664, 6316863979, 6329078614, 6501615456, 5926230957, 6394553069, 6289661736, 1136806719, 6230881179, 6682991613, 5977200432,
	6326078935, 5962262225, 6631276490, 6370434835, 5962965193, 5426502652, 6136151330, 6397377205, 6954170256, 6307170198, 6374889821,
	6315480344, 6680929507, 6406790363, 1922960403, 6323660850, 7183626406, 6853862260, 5254944333, 6738273622, 8016472835, 6626354606,
	8398731628, 515933843, 5129009602, 5930588873, 6973891095, 5978534282, 1683358371, 7670740043, 7222645199, 7391240498, 5344343601,
	6833109665, 7795103727, 1683478894, 1206319321, 697312789, 1473415176, 8275403046, 5094181601, 5127655873, 8039727909, 5430065361,
	1865556750, 1804212623, 6324545977, 215852975, 7482465340, 5766943779, 6416409531, 5811530111, 7881257789, 5064734969, 5568185330,
	5309558315, 7773323047, 1659083056, 7665240843, 7957751230, 1943184865, 1401069750, 7850961656, 6242855501, 5291292901, 6746683134,
	1181735535,
];
export class AdminCommandHandler {
	private broadcastJob: BroadcastJob | null = null;

	register(composer: Composer<BotContext>): void {
		// entry points
		composer.command("admin", this.handleAdminPanel.bind(this));
		composer.hears(BUTTON_ADMIN_PANEL, this.handleAdminPanel.bind(this));

		// admin UI actions
		composer.hears(BUTTON_ADMIN_DASHBOARD, this.handleDashboard.bind(this));
		composer.hears(BUTTON_ADMIN_DOWNLOAD, this.handleDownloadUsers.bind(this));
		composer.hears(BUTTON_ADMIN_DOWNLOAD_WINNERS, this.handleDownloadWinners.bind(this));
		composer.hears(BUTTON_ADMIN_NOTIFY_USERS, this.handleNotifyUsers.bind(this));
		composer.hears(BUTTON_ADMIN_NOTIFY_SELF, this.handleNotifyAdminPreview.bind(this));
		composer.hears(BUTTON_ADMIN_NOTIFY_WINNERS, this.handleNotifySelectedWinners.bind(this));
		// composer.hears(BUTTON_ADMIN_RECALCULATE_REFERRALS, this.handleRecalculateReferrals.bind(this));

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

	private flattenWinnersToCsv(winners: WinnerRecord[]): { filename: string; csv: string } {
		const header = ["userId", "username", "firstName", "lastName", "email", "wallet", "points", "confirmedAt", "updatedAt"];
		const rows = [header.map(this.csvEscape).join(",")];

		for (const winner of winners) {
			const line = [
				winner.userId,
				winner.username ?? "",
				winner.firstName ?? "",
				winner.lastName ?? "",
				winner.email ?? "",
				winner.wallet,
				winner.points ?? "",
				winner.confirmedAt,
				winner.updatedAt,
			];
			rows.push(line.map(this.csvEscape).join(","));
		}

		const csv = rows.join("\n");
		const filename = `winners_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
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

	private async handleDownloadWinners(ctx: BotContext): Promise<void> {
		if (!this.assertAdmin(ctx)) {
			return;
		}

		const winnerService = ctx.services.winnerService;
		const userRepository = ctx.services.userRepository;

		const winners = await winnerService.listWinners();
		if (winners.length === 0) {
			await ctx.reply("There are no confirmed winners yet.", { reply_markup: buildAdminKeyboard() });
			return;
		}

		const winnersWithPoints = await Promise.all(
			winners.map(async (winner) => {
				const user = await userRepository.get(winner.userId);
				const points = typeof winner.points === "number" ? winner.points : user?.points ?? 0;
				return { ...winner, points };
			})
		);
		const sortedWinners = winnersWithPoints.sort((a, b) => {
			const diff = (b.points ?? 0) - (a.points ?? 0);
			if (diff !== 0) {
				return diff;
			}
			return a.confirmedAt.localeCompare(b.confirmedAt);
		});

		const { filename, csv } = this.flattenWinnersToCsv(sortedWinners);
		await ctx.replyWithDocument(new InputFile(Buffer.from(csv, "utf8"), filename), {
			caption: "Confirmed winners (CSV).",
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
		if (!this.assertAdmin(ctx)) {
			return;
		}

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
		if (!this.assertAdmin(ctx)) {
			return;
		}

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

	private async handleNotifySelectedWinners(ctx: BotContext): Promise<void> {
		if (!this.assertAdmin(ctx)) {
			return;
		}

		if (SELECTED_WINNER_IDS.length === 0) {
			await ctx.reply("No selected winners configured. Update SELECTED_WINNER_IDS to continue.", {
				reply_markup: buildAdminKeyboard(),
			});
			return;
		}

		await ctx.reply(`Sending notifications to ${SELECTED_WINNER_IDS.length} selected winner(s)…`, {
			reply_markup: buildAdminKeyboard(),
		});

		let sent = 0;
		let failed = 0;

		for (const userId of SELECTED_WINNER_IDS) {
			try {
				const alreadyWinner = await ctx.services.winnerService.hasWinner(userId);
				// if (alreadyWinner) {
				// 	await ctx.api.sendMessage(userId, WINNER_LOCK_MESSAGE);
				// 	sent += 1;
				// 	continue;
				// }

				const walletHint = await ctx.services.winnerService.resolveWalletHint(userId);
				const message = buildWinnerPromptMessage(walletHint);
				await ctx.api.sendMessage(userId, message);
				sent += 1;
			} catch (error) {
				failed += 1;
				console.error("[adminNotifyWinners] failed to notify winner", { userId, error });
			}
		}

		await ctx.reply(`Winner notification finished. Sent ${sent}, failed ${failed}.`, {
			reply_markup: buildAdminKeyboard(),
		});
	}
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

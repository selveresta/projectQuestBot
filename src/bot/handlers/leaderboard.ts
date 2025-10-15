import { Composer } from "grammy";

import type { BotContext } from "../../types/context";
import { BUTTON_LEADERBOARD, buildMainMenuKeyboard } from "../ui/replyKeyboards";

function formatDisplayName(userId: number, username?: string, firstName?: string, lastName?: string): string {
        if (username) {
                return `@${username}`;
        }
        if (firstName || lastName) {
                return `${firstName ?? ""}${lastName ? ` ${lastName}` : ""}`.trim();
        }
        return `User ${userId}`;
}

export class LeaderboardHandler {
        register(composer: Composer<BotContext>): void {
                const handler = this.handleLeaderboard.bind(this);
                composer.command("leaderboard", handler);
                composer.hears(BUTTON_LEADERBOARD, handler);
        }

        private async handleLeaderboard(ctx: BotContext): Promise<void> {
                if (!ctx.from) {
                        await ctx.reply("I need a Telegram user to show the leaderboard.");
                        return;
                }

                const userId = ctx.from.id;
                const questService = ctx.services.questService;

                const [topUsers, rankInfo] = await Promise.all([
                        questService.getLeaderboard(10),
                        questService.getUserRank(userId),
                ]);

                if (topUsers.length === 0) {
                        await ctx.reply("No participants yet. Complete quests to earn the first points!", {
                                reply_markup: buildMainMenuKeyboard(ctx.config, ctx.chatId),
                        });
                        return;
                }

                const lines: string[] = ["🏆 Top 10 leaderboard", ""];
                topUsers.forEach((entry, index) => {
                        const position = index + 1;
                        const name = formatDisplayName(
                                entry.userId,
                                entry.username,
                                entry.firstName,
                                entry.lastName
                        );
                        const points = entry.points ?? 0;
                        const marker = entry.userId === userId ? " (you)" : "";
                        lines.push(`${position}. ${name} — ${points} point${points === 1 ? "" : "s"}${marker}`);
                });

                if (rankInfo && rankInfo.rank > topUsers.length) {
                        lines.push(
                                "",
                                `Your rank: ${rankInfo.rank}/${rankInfo.total} with ${rankInfo.points} point${rankInfo.points === 1 ? "" : "s"}.`
                        );
                } else if (rankInfo) {
                        lines.push(
                                "",
                                `You are ranked #${rankInfo.rank} with ${rankInfo.points} point${rankInfo.points === 1 ? "" : "s"}.`
                        );
                }

                lines.push(
                        "",
                        "Invite friends with your referral link and complete quests to climb even higher."
                );

                await ctx.reply(lines.join("\n"), {
                        reply_markup: buildMainMenuKeyboard(ctx.config, ctx.chatId),
                        link_preview_options: { is_disabled: true },
                });
        }
}


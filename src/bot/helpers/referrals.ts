import type { BotContext } from "../../types/context";
import type { ReferralReward } from "../../services/questService";
import { buildMainMenuKeyboard } from "../ui/replyKeyboards";

export async function notifyReferralReward(
        ctx: BotContext,
        reward?: ReferralReward
): Promise<void> {
        if (!reward) {
                return;
        }

        const lines = [
                "🔔 Notification: +1 Referral",
                "",
                "🎉 New referral joined!",
                "Your friend has completed their first quest — you’ve just earned +1 referral point.",
                "",
                "Keep sharing your link to climb the leaderboard and boost your rewards!",
        ];

        try {
                await ctx.api.sendMessage(reward.referrer.userId, lines.join("\n"), {
                        reply_markup: buildMainMenuKeyboard(ctx.config, reward.referrer.userId),
                        link_preview_options: { is_disabled: true },
                });
        } catch (error) {
                console.error("[referralNotification] failed to deliver", {
                        referrerId: reward.referrer.userId,
                        error,
                });
        }
}

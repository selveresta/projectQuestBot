import type { BotContext } from "../../types/context";
import { buildMainMenuKeyboard } from "../ui/replyKeyboards";

const REFERRAL_NOTIFICATION_MESSAGE = [
	"🔔 Notification: +1 Referral",
	"",
	"🎉 New referral joined!",
	"Your friend has completed their first quest — you’ve just earned +1 referral point.",
	"",
	"Keep sharing your link to climb the leaderboard and boost your rewards!",
].join("\n");

export async function notifyReferralBonus(ctx: BotContext, referrerId?: number): Promise<void> {
	if (!referrerId) {
		return;
	}

	try {
		await ctx.api.sendMessage(referrerId, REFERRAL_NOTIFICATION_MESSAGE, {
			reply_markup: buildMainMenuKeyboard(ctx.config, referrerId),
			link_preview_options: { is_disabled: true },
		});
	} catch (error) {
		console.error("[referral] Failed to deliver referral notification", {
			referrerId,
			error,
		});
	}
}

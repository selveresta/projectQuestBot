import { Composer } from "grammy";

import type { BotContext } from "../../types/context";
import {
        BUTTON_INVITE_FRIENDS,
        buildMainMenuKeyboard,
        buildReferralInviteMessage,
        buildReferralLink,
} from "../ui/replyKeyboards";

export class ReferralInviteHandler {
        register(composer: Composer<BotContext>): void {
                composer.hears(BUTTON_INVITE_FRIENDS, this.handleInvite.bind(this));
        }

        private async handleInvite(ctx: BotContext): Promise<void> {
                if (!ctx.from) {
                        await ctx.reply("I need a Telegram user to share the referral link.");
                        return;
                }

                const userId = ctx.from.id;
                const referralLink = buildReferralLink(ctx.me?.username, userId);
                if (!referralLink) {
                        await ctx.reply("Referral link is not available right now. Please try again later.", {
                                reply_markup: buildMainMenuKeyboard(ctx.config, ctx.chatId),
                                link_preview_options: { is_disabled: true },
                        });
                        return;
                }

                const user = await ctx.services.userRepository.getOrCreate(userId, {
                        username: ctx.from.username,
                        firstName: ctx.from.first_name,
                        lastName: ctx.from.last_name,
                });

                const referralsCount = user.creditedReferrals?.length ?? 0;
                const message = buildReferralInviteMessage(referralsCount, referralLink);

                await ctx.reply(message, {
                        reply_markup: buildMainMenuKeyboard(ctx.config, ctx.chatId),
                        link_preview_options: { is_disabled: true },
                });
        }
}

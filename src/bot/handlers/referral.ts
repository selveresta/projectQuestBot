import { Composer } from "grammy";

import type { BotContext } from "../../types/context";
import {
        BUTTON_INVITE_FRIENDS,
        buildInviteFriendsMessage,
        buildMainMenuKeyboard,
        buildReferralLink,
} from "../ui/replyKeyboards";

export class ReferralHandler {
        register(composer: Composer<BotContext>): void {
                composer.hears(BUTTON_INVITE_FRIENDS, this.handleInvitePrompt.bind(this));
        }

        private async handleInvitePrompt(ctx: BotContext): Promise<void> {
                if (!ctx.from) {
                        await ctx.reply("I can only chat with real Telegram users.");
                        return;
                }

                const userId = ctx.from.id;
                const repo = ctx.services.userRepository;
                const user = await repo.getOrCreate(userId, {
                        username: ctx.from.username,
                        firstName: ctx.from.first_name,
                        lastName: ctx.from.last_name,
                });

                const referralsCount = user.creditedReferrals?.length ?? 0;
                const referralLink = buildReferralLink(ctx.me?.username, userId);
                const message = buildInviteFriendsMessage({ referralsCount, referralLink });

                await ctx.reply(message, {
                        reply_markup: buildMainMenuKeyboard(ctx.config, ctx.chatId),
                        link_preview_options: { is_disabled: true },
                });
        }
}

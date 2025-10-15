import { Keyboard } from "grammy";

import type { AppConfig } from "../../config";

export const BUTTON_QUEST_LIST = "🗂 Quest list";
export const BUTTON_SET_INSTAGRAM = "📸 Set Instagram profile URL";
export const BUTTON_SET_X = "🔗 Set X profile URL";
// export const BUTTON_SET_DISCORD = "🔗 Set Discord profile ID";
export const BUTTON_CHECK_STATUS = "📊 Check status";
export const BUTTON_ABOUT = "❔ About";
export const BUTTON_BACK_TO_MENU = "⬅️ Back to menu";
export const BUTTON_ADMIN_PANEL = "🛠 Admin panel";
export const BUTTON_ADMIN_DASHBOARD = "📊 Admin dashboard";
export const BUTTON_ADMIN_DOWNLOAD = "⬇️ Download users (CSV)";
export const BUTTON_LEADERBOARD = "🏆 Leaderboard";
export const BUTTON_INVITE_FRIENDS = "⏳ Invite Friends";

export interface MainMenuMessageOptions {
        points?: number;
        referralsCount?: number;
}

export function buildMainMenuMessage(options: MainMenuMessageOptions = {}): string {
        const lines: string[] = [];

        if (typeof options.points === "number") {
                lines.push(`🏅 Your points: ${options.points}`);
        }
        if (typeof options.referralsCount === "number") {
                lines.push(`👥 Referrals confirmed: ${options.referralsCount}`);
        }

        return lines.join("\n");
}

export function buildPostCaptchaWelcomeMessage(): string {
        return [
                "Welcome to the Trady Giveaway 🎉",
                "",
                "Trady it's all-in-one alpha trading terminal.",
                "",
                "Unified Balance • All On-chain • No KYC • Custom UI • Self-Custody",
                "",
                "Get ready to join our exclusive $5,000 reward campaign!",
                "Complete all quests below to enter the draw and secure your spot among 100 winners.",
                "",
                "Only users who finish ALL quests are eligible to win.",
                "",
                "🏆 Rewards:",
                "1st place — $1000 + invite code",
                "2nd place — $550 + invite code",
                "3–5 place — $150 + invite code",
                "6–10 place — $100 + invite code",
                "11–50 place — $40 + invite code",
                "51–100 place — $20 + invite code",
                "",
                "⏰ Period:",
                "",
                "20 October – 10 November",
                "",
                "🪂 Your mission:",
                "Follow Trady on all socials (X, Instagram, Discord, Telegram Channel & Chat), visit our website, and drop your email and wallet (EVM).",
                "",
                'Tap "🗂 Quest list" below and start completing tasks now — every step brings you closer to the rewards.',
        ].join("\n");
}

export function buildInviteFriendsMessage(options: {
        referralsCount: number;
        referralLink?: string;
}): string {
        const { referralsCount, referralLink } = options;
        const lines = [
                "⏳ Invite Friends",
                "",
                "Invite your friends to join the Trady Giveaway and earn points for each active referral.",
                "You’ll receive points only after your referral completes at least one quest.",
                "",
                `Status: ${referralsCount} referrals confirmed.`,
        ];

        if (referralLink) {
                lines.push("", "🔗 Your unique referral link:", referralLink);
        } else {
                lines.push("", "🔗 Your unique referral link:", "Unavailable — please configure the bot username to share a link.");
        }

        lines.push(
                "",
                "📨 Share this link with your friends and start earning points!",
                "",
                'Tip: tap "🗂 Quest list" in the menu to switch quests.'
        );

        return lines.join("\n");
}

export function buildMainMenuKeyboard(config?: AppConfig, adminId?: number): Keyboard {
        const keyboard = new Keyboard().text(BUTTON_QUEST_LIST).text(BUTTON_INVITE_FRIENDS);
        const socialButtons: string[] = [];

        if (!config || config.links.instagramProfileUrl) {
                socialButtons.push(BUTTON_SET_INSTAGRAM);
        }
	if (!config || config.links.xProfileUrl) {
		socialButtons.push(BUTTON_SET_X);
	}

	// if (!config || config.links.discordInviteUrl) {
	// 	socialButtons.push(BUTTON_SET_DISCORD);
	// }

	if (!config || (adminId && config.adminIds.includes(adminId))) {
		socialButtons.push(BUTTON_ADMIN_PANEL);
	}

        if (socialButtons.length > 0) {
                keyboard.row();
                socialButtons.forEach((label) => {
                        keyboard.text(label);
                });
        }

        keyboard
                .row()
                .text(BUTTON_CHECK_STATUS)
                .text(BUTTON_LEADERBOARD);
        return keyboard.resized().persistent();
}

// Побудова адмін-клавіатури
export function buildAdminKeyboard(): Keyboard {
	return new Keyboard()
		.text(BUTTON_ADMIN_DASHBOARD)
		.row()
		.text(BUTTON_ADMIN_DOWNLOAD)
		.row()
		.text(BUTTON_BACK_TO_MENU)
		.resized()
		.persistent();
}

export function buildReferralLink(botUsername: string | undefined, userId: number): string | undefined {
        if (!botUsername) {
                return undefined;
        }
        return `https://t.me/${botUsername}?start=${userId}`;
}

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

export interface MainMenuMessageOptions {
        points?: number;
        referralsCount?: number;
        referralLink?: string;
}

export function buildMainMenuMessage(options: MainMenuMessageOptions = {}): string {
        const lines = [
                "Welcome to the Trady Giveaway 🎉",
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
                "11–50 place — $40",
                "51–100 place — $20",
                "",
                "🪂 Your mission:",
                "Follow Trady on all socials (X, Instagram, Discord, Telegram Channel & Chat), visit our website, and drop your email and wallets (EVM & SOL).",
                "",
                "Tap \"🗂 Quest list\" below and start completing tasks now — every step brings you closer to the rewards.",
        ];

        const extras: string[] = [];
        if (typeof options.points === "number") {
                extras.push(`🏅 Your points: ${options.points}`);
        }
        if (typeof options.referralsCount === "number") {
                extras.push(`👥 Friends credited: ${options.referralsCount}`);
        }
        if (options.referralLink) {
                if (extras.length > 0) {
                        extras.push("");
                }
                extras.push("🔗 Share your referral link:", options.referralLink, "Earn +1 point when a friend completes their first quest.");
        }

        if (extras.length > 0) {
                lines.push("", ...extras);
        }

        return lines.join("\n");
}

export function buildMainMenuKeyboard(config?: AppConfig, adminId?: number): Keyboard {
        const keyboard = new Keyboard().text(BUTTON_QUEST_LIST);
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

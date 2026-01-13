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
export const BUTTON_ADMIN_DOWNLOAD_WINNERS = "⬇️ Download winners (CSV)";
export const BUTTON_ADMIN_CLEANUP_USERS = "🧹 Clean unreachable users";
export const BUTTON_ADMIN_NOTIFY_USERS = "📢 Notify users";
export const BUTTON_ADMIN_NOTIFY_SELF = "📨 Notify me";
export const BUTTON_ADMIN_NOTIFY_WINNERS = "🏅 Notify selected winners";
export const BUTTON_ADMIN_RECALCULATE_REFERRALS = "♻️ Recalculate referrals";
export const BUTTON_LEADERBOARD = "🏆 Leaderboard";
export const BUTTON_INVITE_FRIENDS = "⏳ Invite Friends";

export const MENU_PLACEHOLDER_TEXT = "\u2063";

export function buildWelcomeAnnouncement(): string {
	return [
		"Welcome to the Trady Giveaway 🎉",
		"",
		"Trady it's all-in-one alpha trading terminal.",
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
		"20 October – 17 November",
		"",
		"🪂 Your mission:",
		"Follow Trady on all socials (X, Instagram, Discord, Telegram Channel & Chat), visit our website, and drop your email, EVM wallet, and Solana wallet.",
		"",
		"Tap “🗂 Quest list” below and start completing tasks now — every step brings you closer to the rewards.",
	].join("\n");
}

export function buildReferralInviteMessage(referralsCount: number, referralLink: string): string {
	return [
		"⏳ Invite Friends",
		"",
		"Invite your friends to join the Trady Giveaway and earn 1 point for each active referral.",
		"You’ll receive points only after your referral completes the X subscription quest.",
		"",
		`Status: ${referralsCount} referrals confirmed.`,
		"",
		"🔗 Your unique referral link:",
		`\`${referralLink}\``,
		"",
		"📨 Share this link with your friends and start earning points!",
		"",
		"Tip: tap “🗂 Quest list” in the menu to switch quests.",
	].join("\n");
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

	keyboard.row().text(BUTTON_INVITE_FRIENDS).text(BUTTON_CHECK_STATUS);
	keyboard.row().text(BUTTON_LEADERBOARD).text(BUTTON_ABOUT);
	return keyboard.resized().persistent();
}

// Побудова адмін-клавіатури
export function buildAdminKeyboard(): Keyboard {
	return new Keyboard()
		.text(BUTTON_ADMIN_DASHBOARD)
		.row()
		.text(BUTTON_ADMIN_DOWNLOAD)
		.text(BUTTON_ADMIN_DOWNLOAD_WINNERS)
		.row()
		.text(BUTTON_ADMIN_CLEANUP_USERS)
		.row()
		.text(BUTTON_ADMIN_NOTIFY_USERS)
		.text(BUTTON_ADMIN_NOTIFY_SELF)
		.row()
		.text(BUTTON_ADMIN_NOTIFY_WINNERS)
		.row()
		.text(BUTTON_ADMIN_RECALCULATE_REFERRALS)
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

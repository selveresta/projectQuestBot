import { Keyboard } from "grammy";

import type { AppConfig } from "../../config";

export const BUTTON_QUEST_LIST = "🗂 Quest list";
export const BUTTON_SET_INSTAGRAM = "📸 Set Instagram profile URL";
export const BUTTON_SET_X = "🔗 Set X profile URL";
export const BUTTON_SET_DISCORD = "🔗 Set Discord profile ID";
export const BUTTON_CHECK_STATUS = "📊 Check status";
export const BUTTON_BACK_TO_MENU = "⬅️ Back to menu";
export const BUTTON_ADMIN_PANEL = "🛠 Admin panel";
export const BUTTON_ADMIN_DASHBOARD = "📊 Admin dashboard";
export const BUTTON_ADMIN_DOWNLOAD = "⬇️ Download users (CSV)";

export function buildMainMenuMessage(): string {
	return ["Use the menu below to continue with the quests.", "Tap a button at any time to navigate."].join("\n");
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

	if (!config || config.links.discordInviteUrl) {
		socialButtons.push(BUTTON_SET_DISCORD);
	}

	if (!config || (adminId && config.adminIds.includes(adminId))) {
		socialButtons.push(BUTTON_ADMIN_PANEL);
	}

	if (socialButtons.length > 0) {
		keyboard.row();
		socialButtons.forEach((label) => {
			keyboard.text(label);
		});
	}

	keyboard.row().text(BUTTON_CHECK_STATUS);
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

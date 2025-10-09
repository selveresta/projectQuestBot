import { Keyboard } from "grammy";

import type { AppConfig } from "../../config";

export const BUTTON_QUEST_LIST = "🗂 Quest list";
export const BUTTON_SET_INSTAGRAM = "📸 Set Instagram profile URL";
export const BUTTON_SET_X = "🔗 Set X profile URL";
export const BUTTON_CHECK_STATUS = "📊 Check status";
export const BUTTON_BACK_TO_MENU = "⬅️ Back to menu";

export function buildMainMenuKeyboard(config?: AppConfig): Keyboard {
	const keyboard = new Keyboard().text(BUTTON_QUEST_LIST);
	const socialButtons: string[] = [];

	if (!config || config.links.instagramProfileUrl) {
		socialButtons.push(BUTTON_SET_INSTAGRAM);
	}
	if (!config || config.links.xProfileUrl) {
		socialButtons.push(BUTTON_SET_X);
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

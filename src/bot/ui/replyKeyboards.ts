import { Keyboard } from "grammy";

export const BUTTON_CHECK_STATUS = "📊 Check status";
export const BUTTON_SUBMIT_EMAIL = "✉️ Submit email";
export const BUTTON_SUBMIT_WALLET = "💼 Submit wallet";

export function buildMainMenuKeyboard(): Keyboard {
  return new Keyboard()
    .text(BUTTON_CHECK_STATUS)
    .row()
    .text(BUTTON_SUBMIT_EMAIL)
    .text(BUTTON_SUBMIT_WALLET)
    .resized()
    .persistent();
}

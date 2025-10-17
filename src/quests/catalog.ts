import type { AppConfig } from "../config";
import type { QuestDefinition } from "../types/quest";

export function createQuestDefinitions(config: AppConfig): QuestDefinition[] {
	const {
		telegram,
		links: { discordInviteUrl, instagramProfileUrl, websiteUrl, xProfileUrl },
		discord,
	} = config;

	return [
		{
			id: "telegram_channel",
			title: "Subscribe to the Telegram channel",
			description:
				"Join the official Trady Telegram Channel to stay updated on all project news, product releases, and major announcements.",
			mandatory: true,
			type: "telegram_channel",
			phase: telegram.channelId ? "live" : "stub",
			url: telegram.channelUrl || undefined,
			cta: telegram.channelUrl ? "Open Telegram channel" : undefined,
		},
		{
			id: "telegram_chat",
			title: "Join the Telegram community chat",
			description:
				"Join the official Trady Community Chat to connect with other traders, share insights, and stay updated on everything happening in the ecosystem.",
			mandatory: true,
			type: "telegram_chat",
			phase: telegram.chatId ? "live" : "stub",
			url: telegram.chatUrl || undefined,
			cta: telegram.chatUrl ? "Open Telegram chat" : undefined,
		},
		{
			id: "discord_join",
			title: "Join the Discord server",
			description: "Join the official Discord server and verify your Telegram ID using the !verify command.",
			mandatory: true,
			type: "discord_membership",
			phase: discord.botToken && discord.guildId ? ("live" as const) : ("stub" as const),
			url: discordInviteUrl || undefined,
			cta: discordInviteUrl ? "Open Discord" : undefined,
		},
		{
			id: "x_follow",
			title: "Follow on X (Twitter)",
			description: `
<b>🐦 X — verification steps</b>

1. Tap: <a href="https://x.com/your_profile">Open X profile</a>
2. Click <b>Follow</b>.
3. Return here and tap <b>“✅ Verify X”</b>.

<b>🔁 Already following?</b>
• Unfollow the profile.  
• Wait 5–10 seconds.  
• Tap the quest again: Follow on X(Twitter).
• Follow once more
• Tap <b>“✅ Verify”</b>.

<b>ℹ️ Notes</b>  
• Make sure you’re setup the correct X account.  
• Wait a few seconds for the sync before retrying verification`,
			mandatory: true,
			type: "social_follow",
			phase: "stub",
			url: xProfileUrl || undefined,
			cta: xProfileUrl ? "Open X profile" : undefined,
		},
		{
			id: "instagram_follow",
			title: "Follow on Instagram",
			description: `
<b>📸 Instagram — verification steps</b>

1. Tap: Open Instagram
2. <b>Follow</b> the page.
3. Return here and tap <b>“✅ Verify</b>.

<b>🔁 Already following?</b>
• Unfollow the page.
• Wait 5–10 seconds.
• Tap the quest again: Follow on Instagram.
• Follow once more
• Tap <b>“✅ Verify</b>.

<b>ℹ️ Notes</b>
• Make sure you’re following from the same account you want to verify
• Verification may take a few seconds to sync — retry if it doesn’t pass immediately`,
			mandatory: true,
			type: "social_follow",
			phase: "stub",
			url: instagramProfileUrl || undefined,
			cta: instagramProfileUrl ? "Open Instagram" : undefined,
		},
		{
			id: "website_visit",
			title: "Visit the website",
			description: "Explore the official Trady website to learn more about the platform, features, and upcoming releases.",
			mandatory: true,
			type: "website_visit",
			phase: "stub",
			url: websiteUrl || undefined,
			cta: websiteUrl ? "Open website" : undefined,
		},
		{
			id: "email_submit",
			title: "Drop your email",
			description: "Submit your email address so we can contact you if you win.",
			mandatory: true,
			type: "email_collection",
			phase: "live",
			cta: "Submit email",
		},
		{
			id: "wallet_submit",
			title: "Submit your EVM wallet",
			description: "Provide an EVM-compatible wallet to receive rewards.",
			mandatory: true,
			type: "wallet_collection",
			phase: "live",
			cta: "Submit wallet",
		},
		{
			id: "sol_wallet_submit",
			title: "Submit your SOL wallet",
			description: "Share your Solana wallet address so we can reach you on SOL as well.",
			mandatory: true,
			type: "wallet_collection",
			phase: "live",
			cta: "Submit SOL wallet",
		},
	];
}

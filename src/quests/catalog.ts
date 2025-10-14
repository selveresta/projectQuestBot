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
			description: "Join the official Project Quest announcement channel to receive the latest updates.",
			mandatory: true,
			type: "telegram_channel",
			phase: telegram.channelId ? "live" : "stub",
			url: telegram.channelUrl || undefined,
			cta: telegram.channelUrl ? "Open Telegram channel" : undefined,
		},
		{
			id: "telegram_chat",
			title: "Join the Telegram community chat",
			description: "Participate in the community chat to stay connected with other members.",
			mandatory: true,
			type: "telegram_chat",
			phase: telegram.chatId ? "live" : "stub",
			url: telegram.chatUrl || undefined,
			cta: telegram.chatUrl ? "Open Telegram chat" : undefined,
		},
		{
			id: "discord_join",
			title: "Join the Discord server",
			description: "Join the official Discord server and verify your Telegram ID using the \\!verify command.",
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
• Click on Quest Follow on X(Twitter).
• Follow again.  
• Tap <b>“✅ Verify”</b>.

<b>ℹ️ Notes</b>  
• Make sure you’re setup the correct X account.  
• Allow a few seconds for the follow to sync before retrying verification.
`,
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
• Click on Quest Follow on Instagram.
• Follow again.
• Tap <b>“✅ Verify</b>.

<b>ℹ️ Notes</b>
• Make sure you’re following from the <b>same account</b> you intend to verify.  
• Sometimes verification takes a few seconds to sync—try again if it doesn’t pass immediately.`,
			mandatory: true,
			type: "social_follow",
			phase: "stub",
			url: instagramProfileUrl || undefined,
			cta: instagramProfileUrl ? "Open Instagram" : undefined,
		},
		{
			id: "website_visit",
			title: "Visit the website",
			description: "Explore the official website to learn more about the project vision.",
			mandatory: true,
			type: "website_visit",
			phase: "stub",
			url: websiteUrl || undefined,
			cta: websiteUrl ? "Open website" : undefined,
		},
		{
			id: "email_submit",
			title: "Drop your email",
			description: "Submit an email address so we can reach you if you win.",
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
	];
}

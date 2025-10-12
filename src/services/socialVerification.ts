import { fetchInstagramCounts } from "../x_ig_scripts/instagramFetcher";
import { fetchXCounts } from "../x_ig_scripts/xFetcher";

export type SocialPlatform = "instagram" | "x" | "discord";

export interface SocialCounts {
	url: string;
	followers: number | null;
	following: number | null;
	success: boolean;
}

export interface SocialVerificationBaseline {
	user: SocialCounts;
	target: SocialCounts;
	capturedAt: string;
}

export interface SocialVerificationInput {
	platform: SocialPlatform;
	userUrl: string;
	targetUrl: string;
	waitMs?: number;
	baseline: SocialVerificationBaseline;
}

export interface SocialVerificationOutcome {
	success: boolean;
	reason?: string;
	userBefore?: SocialCounts;
	userAfter?: SocialCounts;
	targetBefore?: SocialCounts;
	targetAfter?: SocialCounts;
}

const configuredWait = Number(process.env.SOCIAL_VERIFY_WAIT_MS);
export const DEFAULT_WAIT_MS = Math.max(Number.isNaN(configuredWait) ? 4000 : configuredWait, 1000);

async function fetchCounts(platform: SocialPlatform, url: string): Promise<SocialCounts | undefined> {
	if (platform === "instagram") {
		return fetchInstagramCounts(url);
	}
	if (platform === "x") {
		return fetchXCounts(url);
	}
	return undefined;
}

function hasValidCounts(entry: SocialCounts | undefined, field: "followers" | "following"): entry is SocialCounts {
	if (!entry) {
		return false;
	}
	return entry[field] !== null;
}

export async function captureSocialBaseline({
	platform,
	userUrl,
	targetUrl,
}: {
	platform: SocialPlatform;
	userUrl: string;
	targetUrl: string;
}): Promise<SocialVerificationBaseline | undefined> {
	const [user, target] = await Promise.all([
		fetchCounts(platform, userUrl),
		fetchCounts(platform, targetUrl),
	]);

	if (!hasValidCounts(user, "following") || !hasValidCounts(target, "followers")) {
		return undefined;
	}

	return {
		user,
		target,
		capturedAt: new Date().toISOString(),
	};
}

export async function verifySocialFollow({
	platform,
	userUrl,
	targetUrl,
	waitMs = DEFAULT_WAIT_MS,
	baseline,
}: SocialVerificationInput): Promise<SocialVerificationOutcome> {
	const { user: userBefore, target: targetBefore } = baseline;
	if (!hasValidCounts(userBefore, "following") || !hasValidCounts(targetBefore, "followers")) {
		return {
			success: false,
			reason: "Could not read baseline counts for the provided profiles.",
			userBefore,
			targetBefore,
		};
	}

	await new Promise((resolve) => setTimeout(resolve, waitMs));

	const [userAfter, targetAfter] = await Promise.all([
		fetchCounts(platform, userUrl),
		fetchCounts(platform, targetUrl),
	]);

	if (!hasValidCounts(userAfter, "following") || !hasValidCounts(targetAfter, "followers")) {
		return {
			success: false,
			reason: "Could not read updated counts after waiting period.",
			userBefore,
			targetBefore,
			userAfter,
			targetAfter,
		};
	}

	const userFollowingChanged = userAfter.following !== userBefore.following;
	const targetFollowersChanged = targetAfter.followers !== targetBefore.followers;

	const userFollowDelta = userAfter.following! - userBefore.following!;
	const targetFollowerDelta = targetAfter.followers! - targetBefore.followers!;
	const userFollowed = userFollowingChanged && userFollowDelta === 1;
	const targetGainedFollower = targetFollowersChanged && targetFollowerDelta === 1;

	const success = userFollowed && targetGainedFollower;

	return {
		success,
		reason: success
			? undefined
			: "Follow verification failed. Please ensure you follow the target profile and try again.",
		userBefore,
		targetBefore,
		userAfter,
		targetAfter,
	};
}

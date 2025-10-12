import { execFile } from "child_process";
import fs from "fs";
import path from "path";
const MAX_BUFFER_BYTES = 1024 * 1024 * 10;

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
	env?: NodeJS.ProcessEnv;
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
const TS_NODE_REGISTER = process.env.SOCIAL_TS_NODE_REGISTER ?? "ts-node/register/transpile-only";

interface ScriptCommand {
	command: string;
	args: string[];
}

function resolveScriptCommand(platform: SocialPlatform): ScriptCommand {
	const baseName = platform === "instagram" ? "inst_count" : "x_count";
	const distPath = path.resolve(process.cwd(), "dist", "x_ig_scripts", `${baseName}.js`);
	if (fs.existsSync(distPath)) {
		return { command: "node", args: [distPath] };
	}

	const srcJs = path.resolve(process.cwd(), "src", "x_ig_scripts", `${baseName}.js`);
	if (fs.existsSync(srcJs)) {
		return { command: "node", args: [srcJs] };
	}

	const srcTs = path.resolve(process.cwd(), "src", "x_ig_scripts", `${baseName}.ts`);
	if (fs.existsSync(srcTs)) {
		return { command: "node", args: ["-r", TS_NODE_REGISTER, srcTs] };
	}

	throw new Error(`Unable to locate script for platform ${platform}`);
}

function parseScriptOutput(stdout: string): SocialCounts | undefined {
	for (const rawLine of stdout.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line) {
			continue;
		}
		try {
			const payload = JSON.parse(line) as {
				url?: unknown;
				followers?: unknown;
				following?: unknown;
			};
			if (typeof payload.url !== "string") {
				continue;
			}
			const followers =
				typeof payload.followers === "number" ? Math.round(payload.followers) : null;
			const following =
				typeof payload.following === "number" ? Math.round(payload.following) : null;
			return {
				url: payload.url,
				followers,
				following,
				success: true,
			};
		} catch {
			// ignore malformed rows
		}
	}
	return undefined;
}

function runProfileScript(
	platform: SocialPlatform,
	url: string,
	env?: NodeJS.ProcessEnv
): Promise<SocialCounts | undefined> {
	const { command, args } = resolveScriptCommand(platform);
	return new Promise((resolve) => {
		execFile(
			command,
			[...args, url],
			{
				env: { ...process.env, ...env },
				maxBuffer: MAX_BUFFER_BYTES,
			},
			(error, stdout, stderr) => {
				const parsed = parseScriptOutput(stdout ?? "");
				if (parsed) {
					resolve(parsed);
					return;
				}
				if (error) {
					console.error("[socialVerification] profile script failed", {
						platform,
						url,
						error,
						stderr,
					});
				}
				resolve(undefined);
			}
		);
	});
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
	env,
}: {
	platform: SocialPlatform;
	userUrl: string;
	targetUrl: string;
	env?: NodeJS.ProcessEnv;
}): Promise<SocialVerificationBaseline | undefined> {
	const [user, target] = await Promise.all([
		runProfileScript(platform, userUrl, env),
		runProfileScript(platform, targetUrl, env),
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
	env,
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
		runProfileScript(platform, userUrl, env),
		runProfileScript(platform, targetUrl, env),
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

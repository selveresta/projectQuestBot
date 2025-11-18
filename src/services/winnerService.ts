import type { RedisClient } from "../infra/redis";
import type { WinnerRecord } from "../types/winner";
import type { UserRepository } from "./userRepository";

const PENDING_WALLET_TTL_SECONDS = 600;

function now(): string {
	return new Date().toISOString();
}

export class WinnerService {
	constructor(private readonly redis: RedisClient, private readonly userRepository: UserRepository) {}

	private winnerKey(userId: number): string {
		return `winner:${userId}`;
	}

	private winnerSetKey(): string {
		return "winner:list";
	}

	private candidateKey(userId: number): string {
		return `winner:candidate_wallet:${userId}`;
	}

	private pendingWalletKey(userId: number): string {
		return `winner:pending_wallet:${userId}`;
	}

	async getWinner(userId: number): Promise<WinnerRecord | null> {
		const payload = await this.redis.get(this.winnerKey(userId));
		if (!payload) {
			return null;
		}
		try {
			return JSON.parse(payload) as WinnerRecord;
		} catch (error) {
			console.error("[winnerService] failed to parse winner record", { userId, error });
			return null;
		}
	}

	async hasWinner(userId: number): Promise<boolean> {
		const result = await this.redis.exists(this.winnerKey(userId));
		return result === 1;
	}

	async listWinners(): Promise<WinnerRecord[]> {
		const ids = await this.redis.sMembers(this.winnerSetKey());
		if (!ids || ids.length === 0) {
			return [];
		}

		const keys = ids.map((rawId) => this.winnerKey(Number(rawId)));
		const values = await this.redis.mGet(keys);
		const winners: WinnerRecord[] = [];
		for (const payload of values) {
			if (!payload) {
				continue;
			}
			try {
				winners.push(JSON.parse(payload) as WinnerRecord);
			} catch (error) {
				console.error("[winnerService] failed to parse winner record during list", { error });
			}
		}

		return winners.sort((a, b) => a.confirmedAt.localeCompare(b.confirmedAt));
	}

	async confirmWinner(userId: number, wallet: string): Promise<WinnerRecord> {
		const sanitizedWallet = wallet.trim();
		if (!sanitizedWallet) {
			throw new Error("Wallet is required to confirm winner");
		}

		const [existing, user] = await Promise.all([this.getWinner(userId), this.userRepository.getOrCreate(userId)]);
		const record: WinnerRecord = {
			userId,
			username: user.username,
			firstName: user.firstName,
			lastName: user.lastName,
			email: user.email,
			wallet: sanitizedWallet,
			points: user.points ?? 0,
			confirmedAt: existing?.confirmedAt ?? now(),
			updatedAt: now(),
		};

		await this.redis
			.multi()
			.set(this.winnerKey(userId), JSON.stringify(record))
			.sAdd(this.winnerSetKey(), String(userId))
			.del(this.candidateKey(userId))
			.del(this.pendingWalletKey(userId))
			.exec();

		return record;
	}

	async getCandidateWallet(userId: number): Promise<string | null> {
		return this.redis.get(this.candidateKey(userId));
	}

	async saveCandidateWallet(userId: number, wallet: string): Promise<void> {
		const sanitized = wallet.trim();
		if (!sanitized) {
			return;
		}
		await this.redis.set(this.candidateKey(userId), sanitized);
	}

	async clearCandidateWallet(userId: number): Promise<void> {
		await this.redis.del(this.candidateKey(userId));
	}

	async beginWalletUpdate(userId: number): Promise<void> {
		await this.redis.set(this.pendingWalletKey(userId), "1", { EX: PENDING_WALLET_TTL_SECONDS });
	}

	async finishWalletUpdate(userId: number): Promise<void> {
		await this.redis.del(this.pendingWalletKey(userId));
	}

	async isAwaitingWallet(userId: number): Promise<boolean> {
		const result = await this.redis.exists(this.pendingWalletKey(userId));
		return result === 1;
	}

	async resolveWalletHint(userId: number): Promise<string | undefined> {
		const candidate = await this.getCandidateWallet(userId);
		if (candidate) {
			return candidate;
		}
		const winner = await this.getWinner(userId);
		if (winner?.wallet) {
			return winner.wallet;
		}
		const user = await this.userRepository.get(userId);
		return user?.wallet ?? undefined;
	}
}

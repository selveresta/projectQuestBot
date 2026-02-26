import type { UserEntity, UserIdentity } from "../../domain/user.entity";

export interface UserRepositoryPort {
	get(userId: number): Promise<UserEntity | null>;
	getOrCreate(userId: number, identity: UserIdentity): Promise<UserEntity>;
	setReferrerIfEmpty(userId: number, referrerId: number): Promise<UserEntity>;
	markReferralBonusClaimed(userId: number): Promise<UserEntity>;
	awardReferralBonus(referrerId: number, referredUserId: number, points: number): Promise<UserEntity | null>;
	listAll(): Promise<UserEntity[]>;
}

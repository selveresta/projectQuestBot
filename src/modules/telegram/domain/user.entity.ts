export interface UserIdentity {
	username?: string;
	firstName?: string;
	lastName?: string;
}

export interface UserEntity extends UserIdentity {
	userId: number;
	points: number;
	referredBy?: number;
	referralBonusClaimed: boolean;
	creditedReferrals: number[];
	createdAt: string;
	updatedAt: string;
}

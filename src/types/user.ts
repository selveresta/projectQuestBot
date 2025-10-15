import type { CaptchaChallenge } from "./captcha";
import type { QuestId } from "./quest";

export interface QuestProgressEntry {
  completed: boolean;
  completedAt?: string;
  metadata?: string;
}

export type QuestProgress = Record<QuestId, QuestProgressEntry>;

export interface UserRecord {
  userId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  captchaPassed: boolean;
  captchaAttempts: number;
  pendingCaptcha?: CaptchaChallenge | null;
  quests: QuestProgress;
  points: number;
  questPoints?: Partial<Record<QuestId, number>>;
  referredBy?: number;
  referralBonusClaimed?: boolean;
  creditedReferrals?: number[];
  email?: string;
  wallet?: string;
  xProfileUrl?: string;
  instagramProfileUrl?: string;
  discordUserId?: string;
  createdAt: string;
  updatedAt: string;
}

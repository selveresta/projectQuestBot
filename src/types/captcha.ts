export interface CaptchaChallenge {
  prompt: string;
  answer: string;
  options: string[];
  createdAt: string;
  expiresAt: string;
}

export const CAPTCHA_TTL_MS = 5 * 60 * 1000;

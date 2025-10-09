import { CAPTCHA_TTL_MS, type CaptchaChallenge } from "../types/captcha";

const EMOJI_POOL = ["🔥", "❄️", "⚡️", "🌊", "🌟", "🍀", "🎯", "🧩", "🎈", "🚀"];

function shuffle<T>(items: T[]): T[] {
  return items
    .map((item) => ({ item, order: Math.random() }))
    .sort((left, right) => left.order - right.order)
    .map((entry) => entry.item);
}

export class CaptchaService {
  createChallenge(): CaptchaChallenge {
    const shuffled = shuffle([...EMOJI_POOL]);
    const answer = shuffled[0];
    const options = shuffle(shuffled.slice(0, 4));
    const prompt = `Tap on ${answer} to prove you are human.`;
    const now = Date.now();

    return {
      prompt,
      answer,
      options,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + CAPTCHA_TTL_MS).toISOString(),
    };
  }

  isExpired(challenge: CaptchaChallenge | undefined | null): boolean {
    if (!challenge) {
      return true;
    }
    return Date.now() > new Date(challenge.expiresAt).getTime();
  }

  verify(
    challenge: CaptchaChallenge | undefined | null,
    response: string,
  ): boolean {
    if (!challenge) {
      return false;
    }
    if (this.isExpired(challenge)) {
      return false;
    }
    return challenge.answer === response;
  }
}

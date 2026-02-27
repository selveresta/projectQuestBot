import type { IsoDateString } from "../../../../../shared/domain/iso-date";
import type { TelegramUserId } from "../value-objects/telegram-user-id";
import type { UserId } from "../value-objects/user-id";

export interface UserRegisteredDomainEvent {
	type: "identity.user_registered";
	userId: UserId;
	telegramUserId: TelegramUserId;
	occurredAt: IsoDateString;
}

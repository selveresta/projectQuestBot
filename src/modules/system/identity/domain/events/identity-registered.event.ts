import type { IsoDateString } from "../../../../../shared/domain/iso-date";
import type { TelegramIdentityId } from "../value-objects/telegram-identity-id";
import type { IdentityId } from "../value-objects/identity-id";

export interface IdentityRegisteredDomainEvent {
	type: "identity.registered";
	identityId: IdentityId;
	telegramIdentityId: TelegramIdentityId;
	occurredAt: IsoDateString;
}

import type { IdentityEntity } from "../../domain/entities/identity.entity";
import type { TelegramIdentityId } from "../../domain/value-objects/telegram-identity-id";
import type { IdentityId } from "../../domain/value-objects/identity-id";

export { IDENTITY_REPOSITORY } from "../../../../../shared/di/tokens";

export interface IdentityRepositoryPort {
	getById(id: IdentityId): Promise<IdentityEntity | null>;
	findByTelegramId(telegramIdentityId: TelegramIdentityId): Promise<IdentityEntity | null>;
	save(identity: IdentityEntity): Promise<void>;
	delete(id: IdentityId): Promise<void>;
	listByIds(ids: readonly IdentityId[]): Promise<IdentityEntity[]>;
}

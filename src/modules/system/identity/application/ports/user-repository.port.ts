import type { UserEntity } from "../../domain/entities/user.entity";
import type { TelegramUserId } from "../../domain/value-objects/telegram-user-id";
import type { UserId } from "../../domain/value-objects/user-id";

export const USER_REPOSITORY = Symbol("USER_REPOSITORY");

export interface UserRepositoryPort {
	getById(id: UserId): Promise<UserEntity | null>;
	findByTelegramId(telegramUserId: TelegramUserId): Promise<UserEntity | null>;
	save(user: UserEntity): Promise<void>;
	delete(id: UserId): Promise<void>;
	listByIds(ids: readonly UserId[]): Promise<UserEntity[]>;
}

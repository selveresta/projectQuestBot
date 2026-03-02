import { ApplicationError } from "./application.error";

export class AccessDeniedError extends ApplicationError {
	constructor(message = "Access denied", userMessage = "This command is not available for your account.") {
		super(message, "access_denied", userMessage);
	}
}

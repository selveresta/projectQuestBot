import { ApplicationError } from "./application.error";

export class RateLimitExceededError extends ApplicationError {
	constructor(message = "Rate limit exceeded") {
		super(message, "rate_limit_exceeded", "Too many requests. Please retry shortly.");
	}
}

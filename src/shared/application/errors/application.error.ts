export class ApplicationError extends Error {
	constructor(
		message: string,
		readonly code: string,
		readonly userMessage: string,
	) {
		super(message);
		this.name = this.constructor.name;
	}
}

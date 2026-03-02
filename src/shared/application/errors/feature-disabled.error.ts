import { ApplicationError } from "./application.error";

export class FeatureDisabledError extends ApplicationError {
	constructor(featureFlag: string) {
		super(
			`Feature flag "${featureFlag}" is disabled`,
			"feature_disabled",
			"This command is currently disabled in this bot.",
		);
	}
}

import { Injectable } from "@nestjs/common";

import { AppConfigService } from "../../config/app-config.service";

@Injectable()
export class ReferralPolicy {
	constructor(private readonly config: AppConfigService) {}

	pointsPerReferral(): number {
		return this.config.referralPoints;
	}
}

import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";

import type { IdGeneratorPort } from "../../application/ports/id-generator.port";

@Injectable()
export class RandomIdGeneratorAdapter implements IdGeneratorPort {
	next(): string {
		return randomUUID();
	}
}

import type { IsoDateString } from "../../domain/iso-date";

export { CLOCK_PORT } from "../../di/tokens";

export interface ClockPort {
	now(): Date;
	nowIso(): IsoDateString;
}

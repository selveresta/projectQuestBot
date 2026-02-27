import type { IsoDateString } from "../../domain/iso-date";

export const CLOCK_PORT = Symbol("CLOCK_PORT");

export interface ClockPort {
	now(): Date;
	nowIso(): IsoDateString;
}

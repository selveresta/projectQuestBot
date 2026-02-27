export { ID_GENERATOR_PORT } from "../../di/tokens";

export interface IdGeneratorPort {
	next(): string;
}

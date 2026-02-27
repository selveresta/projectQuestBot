export interface JobDispatcherPort {
	dispatch<TPayload extends object>(name: string, payload: TPayload): Promise<void>;
}

export { JOB_DISPATCHER } from "../../di/tokens";

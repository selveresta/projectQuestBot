export interface JobDispatcherPort {
	dispatch<TPayload extends object>(name: string, payload: TPayload): Promise<void>;
}

export const JOB_DISPATCHER = Symbol("JOB_DISPATCHER");

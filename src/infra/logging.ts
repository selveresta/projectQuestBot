type ConsoleMethod = "log" | "info" | "warn" | "error" | "debug";

const METHODS: ConsoleMethod[] = ["log", "info", "warn", "error", "debug"];

let installed = false;

export function installTimestampedConsole(): void {
	if (installed) {
		return;
	}
	installed = true;

	for (const method of METHODS) {
		const original = console[method].bind(console);
		console[method] = ((...args: Parameters<typeof original>) => {
			const timestamp = new Date().toISOString();
			if (args.length === 0) {
				original(`[${timestamp}]`);
				return;
			}

			const [first, ...rest] = args;
			if (typeof first === "string") {
				original(`[${timestamp}] ${first}`, ...rest);
			} else {
				original(`[${timestamp}]`, first, ...rest);
			}
		}) as typeof console[typeof method];
	}
}

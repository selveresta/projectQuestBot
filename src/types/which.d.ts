declare module "which" {
	interface Which {
		(command: string): Promise<string>;
		sync(command: string, options?: { nothrow?: boolean }): string;
	}

	const which: Which;
	export = which;
}

import puppeteer, { Browser, LaunchOptions, Page } from "puppeteer";
import which from "which";

const DEFAULT_ARGS = [
	"--no-sandbox",
	"--disable-setuid-sandbox",
	"--disable-dev-shm-usage",
	"--disable-blink-features=AutomationControlled",
	"--hide-scrollbars",
	"--window-size=1366,900",
	"--use-gl=egl",
];

const CHROME_CANDIDATES = [
	"/usr/bin/google-chrome-stable",
	"/usr/bin/google-chrome",
	"/usr/bin/chromium-browser",
	"/usr/bin/chromium",
	"google-chrome-stable",
	"google-chrome",
	"chromium-browser",
	"chromium",
];

const HEADLESS = process.env.HEADLESS === undefined ? true : /^(1|true|yes)$/i.test(String(process.env.HEADLESS));

let browserPromise: Promise<Browser> | null = null;

function findChromeExecutable(): string | undefined {
	const custom = process.env.CHROME_PATH;
	if (custom) {
		return custom;
	}
	for (const candidate of CHROME_CANDIDATES) {
		try {
			const resolved = which.sync(candidate, { nothrow: true });
			if (resolved) {
				return resolved;
			}
		} catch {
			// try next candidate
		}
	}
	return undefined;
}

async function launchBrowser(): Promise<Browser> {
	const options: LaunchOptions = {
		headless: HEADLESS,
		args: DEFAULT_ARGS,
		defaultViewport: null,
	};
	const executablePath = findChromeExecutable();
	if (executablePath) {
		options.executablePath = executablePath;
	}
	return puppeteer.launch(options);
}

async function getBrowser(): Promise<Browser> {
	if (!browserPromise) {
		browserPromise = launchBrowser();
	}
	return browserPromise;
}

class TaskQueue {
	private current: Promise<void> = Promise.resolve();

	enqueue<T>(task: () => Promise<T>): Promise<T> {
		const next = this.current.then(task);
		this.current = next.then(
			() => undefined,
			() => undefined
		);
		return next;
	}
}

const queue = new TaskQueue();

export function runWithPage<T>(handler: (page: Page) => Promise<T>): Promise<T> {
	return queue.enqueue(async () => {
		const browser = await getBrowser();
		const page = await browser.newPage();
		try {
			return await handler(page);
		} finally {
			await page.close().catch(() => {
				// swallow close errors
			});
		}
	});
}

export async function closeSharedBrowser(): Promise<void> {
	if (!browserPromise) {
		return;
	}
	try {
		const browser = await browserPromise;
		await browser.close();
	} catch {
		// ignore close errors
	} finally {
		browserPromise = null;
	}
}

const shutdownSignals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGQUIT"];
for (const signal of shutdownSignals) {
	process.once(signal, async () => {
		await closeSharedBrowser();
		process.exit(0);
	});
}

process.once("beforeExit", () => {
	void closeSharedBrowser();
});

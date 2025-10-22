import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser, LaunchOptions, Page } from "puppeteer";
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

type HeadlessSetting = NonNullable<LaunchOptions["headless"]>;

const HEADLESS_MODE = resolveHeadlessMode();

let browserPromise: Promise<Browser> | null = null;
let launchAttempts = 0;
let taskCounter = 0;

puppeteerExtra.use(StealthPlugin());

function resolveHeadlessMode(): LaunchOptions["headless"] {
	const rawMode = process.env.HEADLESS_MODE?.toLowerCase();
	if (rawMode) {
		if (rawMode === "false" || rawMode === "0" || rawMode === "no") {
			return false;
		}
		if (rawMode === "true" || rawMode === "1" || rawMode === "yes") {
			return true;
		}
		if (["shell", "new", "chrome"].includes(rawMode)) {
			return rawMode as HeadlessSetting;
		}
	}

	const raw = process.env.HEADLESS;
	if (raw === undefined) {
		return "shell";
	}
	if (/^(0|false|no)$/i.test(raw)) {
		return false;
	}
	if (/^(1|true|yes)$/i.test(raw)) {
		return true;
	}
	const candidate = raw.toLowerCase();
	if (["shell", "new", "chrome"].includes(candidate)) {
		return candidate as HeadlessSetting;
	}
	return true;
}

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
	const attempt = ++launchAttempts;
	const options: LaunchOptions = {
		headless: HEADLESS_MODE,
		args: DEFAULT_ARGS,
		defaultViewport: null,
	};
	const executablePath = findChromeExecutable();
	if (executablePath) {
		options.executablePath = executablePath;
	}
	console.info("[browser] launching puppeteer", {
		attempt,
		headless: options.headless,
		executablePath: options.executablePath ?? "default",
		args: options.args,
	});
	try {
		const browser = await puppeteerExtra.launch(options);
		console.info("[browser] launch successful", { attempt });
		return browser;
	} catch (error) {
		console.error("[browser] launch failed", { attempt, error });
		throw error;
	}
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
		const taskId = ++taskCounter;
		console.info("[browser] starting task", { taskId });
		const browser = await getBrowser();
		const page = await browser.newPage();
		console.info("[browser] page opened", { taskId });
		try {
			const result = await handler(page);
			console.info("[browser] task completed", { taskId });
			return result;
		} finally {
			await page.close().catch(() => {
				// swallow close errors
			});
			console.info("[browser] page closed", { taskId });
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
		console.info("[browser] closed shared instance");
	} catch {
		// ignore close errors
	} finally {
		browserPromise = null;
	}
}

const shutdownSignals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGQUIT"];
for (const signal of shutdownSignals) {
	process.once(signal, async () => {
		console.info("[browser] received shutdown signal", { signal });
		await closeSharedBrowser();
		process.exit(0);
	});
}

process.once("beforeExit", () => {
	console.info("[browser] beforeExit triggered");
	void closeSharedBrowser();
});

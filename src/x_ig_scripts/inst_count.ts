import { closeSharedBrowser } from "./browserManager";
import { fetchInstagramCounts } from "./instagramFetcher";

async function main(urls: string[]): Promise<void> {
	const results = [];
	let hasError = false;

	for (const url of urls) {
		const result = await fetchInstagramCounts(url);
		if (result) {
			results.push(result);
			if (!result.success) {
				hasError = true;
			}
		} else {
			results.push({
				url,
				followers: null,
				following: null,
				success: false,
			});
			hasError = true;
		}
	}

	results.forEach((result) => {
		console.log(JSON.stringify(result));
	});

	await closeSharedBrowser();
	process.exit(hasError ? 1 : 0);
}

const urls = process.argv.slice(2);
if (urls.length === 0) {
	console.error("Usage: ts-node inst_count.ts <url1> <url2> ...");
	process.exit(1);
}

main(urls).catch(async (error) => {
	console.error(error);
	await closeSharedBrowser();
	process.exit(1);
});


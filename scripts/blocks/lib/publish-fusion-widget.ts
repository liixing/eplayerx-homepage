import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchFusionWidgetItems, fusionBlockSuffix } from "./fusion.js";
import { fetchTraktListItems } from "./trakt.js";

/** Publish hidden child snapshots from a fusion widget JSON export. */
export async function publishFusionWidgetBlocks(opts: {
	submissionId: string;
	language: string;
	blockIdPrefix: string;
	sourceUrl: string;
}): Promise<void> {
	const items = await fetchFusionWidgetItems(opts.sourceUrl);
	let failed = false;
	for (const item of items) {
		const blockId = `${opts.blockIdPrefix}-${fusionBlockSuffix(item.title)}`;
		try {
			await publishBlock({
				submissionId: opts.submissionId,
				blockId,
				mediaType: "movie",
				language: opts.language,
				useTmdbTitle: true,
				fetchItems: () =>
					fetchTraktListItems(item.username, item.listSlug, "movies"),
			});
		} catch (error) {
			failed = true;
			console.error(`✗ ${blockId} failed:`, error);
		}
	}
	if (failed) process.exit(1);
}

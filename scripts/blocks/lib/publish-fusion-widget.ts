import {
	type PublishItem,
	publishBlock,
} from "../../../src/blocks/publish.js";
import {
	fetchFusionStreamingItems,
	fetchFusionTraktCollectionEntries,
	fetchFusionWidgetItems,
	type FusionStreamingItem,
	fusionBlockSuffix,
} from "./fusion.js";
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

async function fetchStreamingPlatformItems(
	item: FusionStreamingItem,
): Promise<PublishItem[]> {
	const out: PublishItem[] = [];
	for (const source of item.sources) {
		const rows = await fetchTraktListItems(
			source.username,
			source.listSlug,
			source.itemType,
		);
		const mediaType = source.itemType === "movies" ? "movie" : "tv";
		out.push(...rows.map((row) => ({ ...row, mediaType })));
	}
	return out;
}

/** Publish hidden child snapshots from a fusion streaming widget export. */
export async function publishFusionStreamingBlocks(opts: {
	submissionId: string;
	language: string;
	blockIdPrefix: string;
	sourceUrl: string;
}): Promise<Array<{ blockId: string; label: string; image?: string }>> {
	const items = await fetchFusionStreamingItems(opts.sourceUrl);
	const children: Array<{ blockId: string; label: string; image?: string }> =
		[];
	let failed = false;
	for (const item of items) {
		const blockId = `${opts.blockIdPrefix}-${fusionBlockSuffix(item.title)}`;
		try {
			await publishBlock({
				submissionId: opts.submissionId,
				blockId,
				mediaType: "tv",
				language: opts.language,
				useTmdbTitle: true,
				fetchItems: () => fetchStreamingPlatformItems(item),
			});
			children.push({
				blockId,
				label: item.title,
				...(item.imageURL ? { image: item.imageURL } : {}),
			});
		} catch (error) {
			failed = true;
			console.error(`✗ ${blockId} failed:`, error);
		}
	}
	if (failed) process.exit(1);
	return children;
}

/** Publish hidden child snapshots from a fusion `collections.json` export. */
export async function publishFusionTraktCollectionBlocks(opts: {
	submissionId: string;
	language: string;
	blockIdPrefix: string;
	sourceUrl: string;
	limit?: number;
}): Promise<Array<{ blockId: string; label: string; image?: string }>> {
	const entries = await fetchFusionTraktCollectionEntries(opts.sourceUrl);
	const slice = opts.limit ? entries.slice(0, opts.limit) : entries;
	const children: Array<{ blockId: string; label: string; image?: string }> =
		[];
	let failed = false;
	for (const entry of slice) {
		const blockId = `${opts.blockIdPrefix}-${fusionBlockSuffix(entry.name)}`;
		try {
			await publishBlock({
				submissionId: opts.submissionId,
				blockId,
				mediaType: "movie",
				language: opts.language,
				useTmdbTitle: true,
				fetchItems: () =>
					fetchTraktListItems(entry.username, entry.listSlug, "movies"),
			});
			children.push({
				blockId,
				label: entry.name,
				...(entry.imageURL ? { image: entry.imageURL } : {}),
			});
		} catch (error) {
			failed = true;
			console.error(`✗ ${blockId} failed:`, error);
		}
	}
	if (failed) process.exit(1);
	return children;
}

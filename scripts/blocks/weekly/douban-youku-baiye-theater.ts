/**
 * Douban doulist "白夜剧场（优酷）" (douban.com/doulist/159320021), the Youku
 * suspense-drama theater lineup, refreshed weekly as new seasons premiere.
 * Submission: 白夜剧场（优酷） (zh-CN, tv, poster-list) by @优酷.
 *
 * Run: bun run scripts/blocks/weekly/douban-youku-baiye-theater.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

/** Pinned where the bare title hits a foreign show first. */
const KNOWN_IDS: Record<string, number> = {
	悬案: 273114,
};

await publishBlock({
	submissionId: "1eaba8849195",
	blockId: "community-youku-baiye-theater",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: async () =>
		(await fetchDoulistItems("159320021", { types: ["tv"] })).map((item) => ({
			...item,
			tmdbId: KNOWN_IDS[item.title],
		})),
});

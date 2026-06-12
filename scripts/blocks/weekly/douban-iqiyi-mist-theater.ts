/**
 * Douban doulist "迷雾剧场（爱奇艺）" (douban.com/doulist/128396349), the iQIYI
 * suspense-drama theater lineup, refreshed weekly as new seasons premiere.
 * Submission: 迷雾剧场（爱奇艺） (zh-CN, tv, thumb-list) by @爱奇艺.
 *
 * Run: bun run scripts/blocks/weekly/douban-iqiyi-mist-theater.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

/** Pinned where the bare title hits a foreign show first. */
const KNOWN_IDS: Record<string, number> = {
	错位: 258924,
};

await publishBlock({
	submissionId: "da4344605a40",
	blockId: "community-iqiyi-mist-theater",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: async () =>
		(await fetchDoulistItems("128396349", { types: ["tv"] })).map((item) => ({
			...item,
			tmdbId: KNOWN_IDS[item.title],
		})),
});

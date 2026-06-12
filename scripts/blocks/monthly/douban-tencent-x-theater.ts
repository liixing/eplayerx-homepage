/**
 * Douban doulist "腾讯【X剧场】片单" (douban.com/doulist/155026800), the Tencent
 * suspense-drama theater lineup, refreshed monthly as new seasons premiere.
 * Submission: X剧场（腾讯） (zh-CN, tv, thumb-list) by @腾讯.
 *
 * Run: bun run scripts/blocks/monthly/douban-tencent-x-theater.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

/** Pinned where the bare title hits the wrong TMDB entry (unaired dramas). */
const KNOWN_IDS: Record<string, number> = {
	金色: 294487,
	人鱼: 273119,
};

await publishBlock({
	submissionId: "0d8269e76bc0",
	blockId: "community-tencent-x-theater",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: async () =>
		(await fetchDoulistItems("155026800", { types: ["tv"] })).map((item) => ({
			...item,
			tmdbId: KNOWN_IDS[item.title],
		})),
});

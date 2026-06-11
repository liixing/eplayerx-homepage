/**
 * Douban subject collection "高分经典日剧榜" (subject_collection/ECBQCUATA).
 * Submission: 豆瓣：高分经典日剧榜 (zh-CN, tv, poster-list).
 *
 * Douban titles carry season suffixes, so the TMDB localized show title
 * is stored instead of the scraped one.
 *
 * Run: bun run scripts/blocks/manual/douban-classic-jp-drama.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchSubjectCollectionItems } from "../lib/douban.js";

/** Bare trailing season numbers ("半泽直树2") miss TMDB search; pin show ids. */
const KNOWN_IDS: Record<string, number> = {
	半泽直树2: 55925,
	深夜食堂2: 47008,
};

await publishBlock({
	submissionId: "f552a8a80994",
	blockId: "community-douban-classic-jp-drama",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: async () =>
		(await fetchSubjectCollectionItems("ECBQCUATA")).map((item) => ({
			...item,
			tmdbId: KNOWN_IDS[item.title],
		})),
});

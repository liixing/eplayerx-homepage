/**
 * Douban subject collection "高分经典港剧榜" (subject_collection/ECVM47WUA).
 * Submission: 豆瓣：高分经典港剧榜 (zh-CN, tv, poster-list).
 *
 * Douban titles carry season suffixes, so the TMDB localized show title
 * is stored instead of the scraped one.
 *
 * Run: bun run scripts/blocks/manual/douban-classic-hk-drama.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchSubjectCollectionItems } from "../lib/douban.js";

/** Douban titles that miss TMDB search (TMDB names the show plain "创世纪"). */
const KNOWN_IDS: Record<string, number> = {
	"创世纪1：地产风云": 1358,
};

await publishBlock({
	submissionId: "79ea1c64fb05",
	blockId: "community-douban-classic-hk-drama",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: async () =>
		(await fetchSubjectCollectionItems("ECVM47WUA")).map((item) => ({
			...item,
			tmdbId: KNOWN_IDS[item.title],
		})),
});

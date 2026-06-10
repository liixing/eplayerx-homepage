/**
 * Douban doulist "高分国产动画电影" (douban.com/doulist/149670450).
 * Submission: 豆瓣：高分国产动画电影 (zh-CN, movie, poster-list).
 *
 * The doulist is still maintained by its curator, so it refreshes monthly.
 *
 * Run: bun run scripts/blocks/monthly/douban-cn-animation-movies.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

/** Douban titles that miss TMDB search (e.g. "魁拔Ⅲ" vs TMDB's "魁拔之"). */
const KNOWN_IDS: Record<string, number> = {
	魁拔Ⅲ战神崛起: 313302,
};

await publishBlock({
	submissionId: "4ef2f9bdb581",
	blockId: "community-douban-cn-animation-movies",
	mediaType: "movie",
	language: "zh-CN",
	fetchItems: async () =>
		(await fetchDoulistItems("149670450")).map((item) => ({
			...item,
			tmdbId: KNOWN_IDS[item.title],
		})),
});

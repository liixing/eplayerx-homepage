/**
 * Douban Movie Top 250 (movie.douban.com/top250).
 * Submission: 豆瓣电影Top250 (zh-CN, movie, poster-list, ranked) by @棒冰冰.
 *
 * Uses the rexxar subject_collection `movie_top250`, which serves the same
 * ranked list as the desktop page without the anti-scraping hurdles.
 *
 * Run: bun run scripts/blocks/monthly/douban-top250.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchSubjectCollectionItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "720f708b7968",
	blockId: "community-douban-top250",
	mediaType: "movie",
	language: "zh-CN",
	fetchItems: () => fetchSubjectCollectionItems("movie_top250", 250),
});

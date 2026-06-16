/**
 * Douban "一周口碑电影榜" (subject_collection/movie_weekly_best).
 * Submission: 一周口碑电影榜 (zh-CN, movie, thumb-list, ranked).
 *
 * Run: bun run scripts/blocks/weekly/douban-weekly-best-movies.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchSubjectCollectionItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "635175ec082e",
	blockId: "community-douban-weekly-best-movies",
	mediaType: "movie",
	language: "zh-CN",
	fetchItems: () => fetchSubjectCollectionItems("movie_weekly_best"),
});

/**
 * Douban "90年代中国经典高分电影" (subject_collection/3957).
 * Submission: 90年代中国经典高分电影 (zh-CN, movie, thumb-list, ranked).
 *
 * Run: bun run scripts/blocks/manual/douban-90s-chinese-classic-movies.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchSubjectCollectionItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "212aa6175872",
	blockId: "community-douban-90s-chinese-classic-movies",
	mediaType: "movie",
	language: "zh-CN",
	fetchItems: () => fetchSubjectCollectionItems("3957"),
});

/**
 * Douban doulist "50部时空循环电影" (doulist/141056006).
 * Submission: 50部时空循环电影 (zh-CN, movie, thumb-list).
 *
 * Run: bun run scripts/blocks/manual/douban-time-loop-movies.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "b9da5ff6dfb0",
	blockId: "community-douban-time-loop-movies",
	mediaType: "movie",
	language: "zh-CN",
	fetchItems: () => fetchDoulistItems("141056006"),
});

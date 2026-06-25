/**
 * Douban doulist "值得N刷的高分电影" (doulist/111683498).
 * Submission: 值得N刷的高分电影 (zh-CN, movie, thumb-list).
 *
 * Run: bun run scripts/blocks/manual/douban-rewatchable-movies.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "dbca602ce921",
	blockId: "community-douban-rewatchable-movies",
	mediaType: "movie",
	language: "zh-CN",
	fetchItems: () => fetchDoulistItems("111683498"),
});

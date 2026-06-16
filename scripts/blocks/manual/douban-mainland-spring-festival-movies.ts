/**
 * Douban doulist "中国大陆历年春节档电影（2011-2026）".
 * Submission: 中国大陆历年春节档电影（2011-2026） (zh-CN, movie, thumb-list, ranked).
 *
 * Run: bun run scripts/blocks/manual/douban-mainland-spring-festival-movies.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "31e77db54e58",
	blockId: "community-douban-mainland-spring-festival-movies",
	mediaType: "movie",
	language: "zh-CN",
	fetchItems: () => fetchDoulistItems("163707546"),
});

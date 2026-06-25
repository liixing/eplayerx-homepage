/**
 * Douban doulist "国产电影Top250" (doulist/157864682).
 * Submission: 国产电影Top250 (zh-CN, movie, thumb-list).
 *
 * Run: bun run scripts/blocks/manual/douban-domestic-top250-movies.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "baf90ced6af5",
	blockId: "community-douban-domestic-top250-movies",
	mediaType: "movie",
	language: "zh-CN",
	fetchItems: () => fetchDoulistItems("157864682", { max: 250 }),
});

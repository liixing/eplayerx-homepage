/**
 * Douban doulist "IMDb上评分超过5000次的中国电影" (doulist/108560843).
 * Submission: IMDb上评分超过5000次的中国电影 (zh-CN, movie, thumb-list).
 *
 * Run: bun run scripts/blocks/manual/douban-imdb-5k-cn-movies.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "d3a7e8e99f14",
	blockId: "community-douban-imdb-5k-cn-movies",
	mediaType: "movie",
	language: "zh-CN",
	fetchItems: () => fetchDoulistItems("108560843", { types: ["movie"], max: 200 }),
});

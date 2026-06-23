/**
 * Douban doulist "女性电影Top300" (douban.com/doulist/161498552).
 * Submission: 女性电影Top300 (zh-CN, movie, thumb-list).
 *
 * Run: bun run scripts/blocks/manual/douban-women-films-top300.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "2d0c9fdfeba4",
	blockId: "community-douban-women-films-top300",
	mediaType: "movie",
	language: "zh-CN",
	fetchItems: () => fetchDoulistItems("161498552", { max: 300 }),
});

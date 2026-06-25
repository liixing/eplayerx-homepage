/**
 * Douban doulist "各题材高分杰作影片汇总" (doulist/158598690).
 * Submission: 各题材高分杰作影片汇总 (zh-CN, movie, thumb-list).
 *
 * Run: bun run scripts/blocks/manual/douban-high-rated-by-genre.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "39cc8a9ae2f7",
	blockId: "community-douban-high-rated-by-genre",
	mediaType: "movie",
	language: "zh-CN",
	fetchItems: () => fetchDoulistItems("158598690", { max: 300 }),
});

/**
 * Douban doulist "时光网TOP100" (doulist/2490799).
 * Submission: 时光网Top100 (zh-CN, movie, thumb-list).
 *
 * Run: bun run scripts/blocks/manual/douban-mtime-top100.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "7679fdf56c43",
	blockId: "community-douban-mtime-top100",
	mediaType: "movie",
	language: "zh-CN",
	fetchItems: () => fetchDoulistItems("2490799", { types: ["movie"], max: 100 }),
});

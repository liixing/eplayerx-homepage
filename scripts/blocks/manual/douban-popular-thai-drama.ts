/**
 * Douban doulist "豆瓣人气泰剧" (doulist/116204055).
 * Submission: 豆瓣人气泰剧 (zh-CN, movie, thumb-list) — corrected to tv.
 *
 * Run: bun run scripts/blocks/manual/douban-popular-thai-drama.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "dc4f159dc274",
	blockId: "community-douban-popular-thai-drama",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () => fetchDoulistItems("116204055", { types: ["tv"] }),
});

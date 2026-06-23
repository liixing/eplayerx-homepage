/**
 * Douban doulist "豆瓣人气港剧" (doulist/36864746).
 * Submission: 豆瓣人气港剧 (zh-CN, movie, thumb-list) — corrected to tv.
 *
 * Run: bun run scripts/blocks/manual/douban-popular-hk-drama.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "f23978e4f2ae",
	blockId: "community-douban-popular-hk-drama",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () => fetchDoulistItems("36864746", { types: ["tv"] }),
});

/**
 * Douban doulist "豆瓣人气台剧" (doulist/156433013).
 * Submission: 豆瓣人气台剧 (zh-CN, movie, thumb-list) — corrected to tv.
 *
 * Run: bun run scripts/blocks/manual/douban-popular-tw-drama.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "7a5242e62fe3",
	blockId: "community-douban-popular-tw-drama",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () => fetchDoulistItems("156433013", { types: ["tv"] }),
});

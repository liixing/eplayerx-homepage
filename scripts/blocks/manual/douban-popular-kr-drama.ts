/**
 * Douban doulist "豆瓣人气韩剧" (doulist/36731518).
 * Submission: 豆瓣人气韩剧 (zh-CN, movie, thumb-list) — corrected to tv.
 *
 * Run: bun run scripts/blocks/manual/douban-popular-kr-drama.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "4ec3dc0508f4",
	blockId: "community-douban-popular-kr-drama",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () =>
		fetchDoulistItems("36731518", { types: ["tv"], max: 300 }),
});

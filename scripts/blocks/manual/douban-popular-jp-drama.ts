/**
 * Douban doulist "豆瓣人气日剧" (doulist/36731587).
 * Submission: 豆瓣人气日剧 (zh-CN, movie, thumb-list) — corrected to tv.
 *
 * Run: bun run scripts/blocks/manual/douban-popular-jp-drama.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "b1bbf80c9f89",
	blockId: "community-douban-popular-jp-drama",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () =>
		fetchDoulistItems("36731587", { types: ["tv"], max: 300 }),
});

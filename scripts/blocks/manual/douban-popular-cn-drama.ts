/**
 * Douban doulist "豆瓣人气国产剧" (doulist/36929192).
 * Submission: 豆瓣人气国产剧 (zh-CN, movie, thumb-list) — corrected to tv.
 *
 * Run: bun run scripts/blocks/manual/douban-popular-cn-drama.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "e538db905295",
	blockId: "community-douban-popular-cn-drama",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () =>
		fetchDoulistItems("36929192", { types: ["tv"], max: 300 }),
});

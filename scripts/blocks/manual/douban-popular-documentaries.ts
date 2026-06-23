/**
 * Douban doulist "豆瓣人气纪录片" (doulist/45761011).
 * Submission: 豆瓣人气纪录片 (zh-CN, movie, thumb-list) — corrected to tv.
 *
 * Run: bun run scripts/blocks/manual/douban-popular-documentaries.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "db8d10c95eba",
	blockId: "community-douban-popular-documentaries",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () => fetchDoulistItems("45761011", { types: ["tv"] }),
});

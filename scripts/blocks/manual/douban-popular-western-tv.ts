/**
 * Douban doulist "豆瓣人气英美剧" (doulist/37523091).
 * Submission: 豆瓣人气英美剧 (zh-CN, movie, thumb-list) — corrected to tv.
 *
 * Run: bun run scripts/blocks/manual/douban-popular-western-tv.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "455e892617be",
	blockId: "community-douban-popular-western-tv",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () =>
		fetchDoulistItems("37523091", { types: ["tv"], max: 300 }),
});

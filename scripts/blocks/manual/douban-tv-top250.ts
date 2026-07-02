/**
 * Douban doulist "豆瓣电视剧Top250" (doulist/134440083).
 * Submission: 豆瓣电视剧Top250 (zh-CN, movie, thumb-list) — corrected to tv.
 *
 * Run: bun run scripts/blocks/manual/douban-tv-top250.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "e3c1323876d9",
	blockId: "community-douban-tv-top250",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () =>
		fetchDoulistItems("134440083", { types: ["tv"], max: 250 }),
});

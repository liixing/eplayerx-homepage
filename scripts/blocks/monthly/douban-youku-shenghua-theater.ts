/**
 * Douban doulist "优酷生花剧场" (douban.com/doulist/159054707), the Youku
 * costume/romance theater lineup, refreshed monthly as new seasons premiere.
 * Hidden chart feeding the 国内各大剧场 collection block.
 * Submission: 国内各大剧场精选 (zh-CN, tv, thumb-list) by @epx-mac端用户.
 *
 * Run: bun run scripts/blocks/monthly/douban-youku-shenghua-theater.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "f7b808b3821e",
	blockId: "community-youku-shenghua-theater",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () => fetchDoulistItems("159054707", { types: ["tv"] }),
});

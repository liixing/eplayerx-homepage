/**
 * Douban doulist "爱奇艺恋恋剧场" (douban.com/doulist/153511620), the iQIYI
 * romance-drama theater lineup, refreshed monthly as new seasons premiere.
 * Hidden chart feeding the 国内各大剧场 collection block.
 * Submission: 国内各大剧场精选 (zh-CN, tv, thumb-list) by @epx-mac端用户.
 *
 * Run: bun run scripts/blocks/monthly/douban-iqiyi-lianlian-theater.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "f7b808b3821e",
	blockId: "community-iqiyi-lianlian-theater",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () => fetchDoulistItems("153511620", { types: ["tv"] }),
});

/**
 * Douban doulist "X剧场（腾讯）" (douban.com/doulist/156986132), the Tencent
 * suspense-drama theater lineup, refreshed weekly as new seasons premiere.
 * Submission: X剧场（腾讯） (zh-CN, tv, thumb-list) by @腾讯.
 *
 * Run: bun run scripts/blocks/weekly/douban-tencent-x-theater.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "0d8269e76bc0",
	blockId: "community-tencent-x-theater",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () => fetchDoulistItems("156986132", { types: ["tv"] }),
});

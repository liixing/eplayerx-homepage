/**
 * Douban doulist "豆瓣评价人数过十万的影片【国产篇】" (doulist/1817142).
 * Submission: 豆瓣评价人数过十万的影片【国产篇】 (zh-CN, movie, thumb-list).
 *
 * Run: bun run scripts/blocks/manual/douban-100k-raters-domestic.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "6340a88d9664",
	blockId: "community-douban-100k-raters-domestic",
	mediaType: "movie",
	language: "zh-CN",
	fetchItems: () => fetchDoulistItems("1817142", { max: 300 }),
});

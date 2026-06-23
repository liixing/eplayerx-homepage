/**
 * Douban doulist "豆瓣评价人数过十万的影片【国外篇】" (doulist/1748449).
 * Submission: 豆瓣评价人数过十万的影片【国外篇】 (zh-CN, movie, thumb-list).
 *
 * Run: bun run scripts/blocks/manual/douban-100k-raters-foreign.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "24bbdba7cf09",
	blockId: "community-douban-100k-raters-foreign",
	mediaType: "movie",
	language: "zh-CN",
	fetchItems: () => fetchDoulistItems("1748449", { max: 300 }),
});

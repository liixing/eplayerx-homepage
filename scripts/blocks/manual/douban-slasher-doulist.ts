/**
 * Douban doulist "血腥屠夫：杀人狂电影" (douban.com/doulist/140335114).
 * Submission: 血腥屠夫：杀人狂电影 (zh-CN, movie, poster-list) by @鱼鱼.
 *
 * The doulist changes rarely; rerun by hand when the curator updates it.
 *
 * Run: bun run scripts/blocks/manual/douban-slasher-doulist.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "d764586ac919",
	blockId: "community-douban-slasher",
	mediaType: "movie",
	language: "zh-CN",
	fetchItems: () => fetchDoulistItems("140335114"),
});

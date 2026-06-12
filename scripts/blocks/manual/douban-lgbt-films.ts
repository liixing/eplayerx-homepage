/**
 * Douban doulist "He loves a man, she loves a woman" (douban.com/doulist/13729),
 * a curated LGBT film list. Static collection, refreshed manually.
 * Submission: He loves a man, she loves a woman (zh-CN, movie, poster-list)
 * by @douban.
 *
 * Run: bun run scripts/blocks/manual/douban-lgbt-films.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "6dc1aef2efab",
	blockId: "community-douban-lgbt-films",
	mediaType: "movie",
	language: "zh-CN",
	fetchItems: () => fetchDoulistItems("13729", { max: 200 }),
});

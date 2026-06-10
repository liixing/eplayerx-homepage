/**
 * Douban doulist "日本电影必看100部TOP100" (douban.com/doulist/140851169).
 * Block title: Top 100 日本电影 (zh-CN, movie, poster-list).
 *
 * The doulist is a curated fixed list, so this only runs on demand.
 * Keeps the original Letterboxd blockId to overwrite the snapshot in place.
 *
 * Run: bun run scripts/blocks/manual/douban-top100-japanese.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "3b9617abd395",
	blockId: "community-letterboxd-top100-japanese",
	mediaType: "movie",
	language: "zh-CN",
	fetchItems: () => fetchDoulistItems("140851169"),
});

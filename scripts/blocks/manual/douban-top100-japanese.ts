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

/** TMDB ids pinned by hand where zh-CN search mismatches. */
const KNOWN_IDS: Record<string, number> = {
	// zh-CN search drifts to a 2012 same-title entry.
	奇迹: 79382,
};

await publishBlock({
	submissionId: "3b9617abd395",
	blockId: "community-letterboxd-top100-japanese",
	mediaType: "movie",
	language: "zh-CN",
	fetchItems: async () =>
		(await fetchDoulistItems("140851169")).map((item) => ({
			...item,
			tmdbId: KNOWN_IDS[item.title],
		})),
});

/**
 * Douban doulist "片单｜韩国电影TOP100" (douban.com/doulist/138515831),
 * the koreanscreen.com critics poll of the 100 greatest Korean films.
 * Block title: Top 100 韩国电影 (zh-CN, movie, poster-list).
 *
 * The doulist is a fixed snapshot, so this only runs on demand.
 *
 * Run: bun run scripts/blocks/manual/douban-top100-korean.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

/** TMDB ids pinned by hand where the doulist entry or zh-CN search mismatches. */
const KNOWN_IDS: Record<string, number> = {
	// The doulist links Scorsese's 1976 Taxi Driver by mistake; the ranked
	// film is "A Taxi Driver" (택시운전사, 2017).
	出租车司机: 437068,
	// zh-CN search misses; TMDB title is "Woman of Fire '82" (화녀 '82).
	"火女(82版)": 120629,
	// Short zh-CN title drifts to The Dark Knight (2008).
	蝙蝠: 22536,
};

await publishBlock({
	submissionId: "bf92fc295738",
	blockId: "community-letterboxd-top100-korean",
	mediaType: "movie",
	language: "zh-CN",
	fetchItems: async () =>
		(await fetchDoulistItems("138515831")).map((item) => ({
			...item,
			tmdbId: KNOWN_IDS[item.title],
		})),
});

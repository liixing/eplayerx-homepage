/**
 * Douban doulist "高分短片" (douban.com/doulist/222008), top-rated short
 * films (animated and live-action).
 * Submission: 高分短片 (zh-CN, movie, poster-list) by @doubon.
 *
 * Run: bun run scripts/blocks/manual/douban-top-short-films.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

/** Generic one-word titles that year-match unrelated features otherwise. */
const KNOWN_IDS: Record<string, number> = {
	黑洞: 105759, // The Black Hole (2008 UK short)
	瓶子: 182865, // Bottle (Kirsten Lepore)
	桥: 82040, // Most (2003)
	雷恩: 48329, // Ryan (2004 NFB)
	熊的故事: 351981, // Historia de un oso
};

/** Shorts with no standalone TMDB entry (e.g. anthology segments). */
const EXCLUDE = new Set(["早上好"]);

await publishBlock({
	submissionId: "116a384fcec6",
	blockId: "community-douban-top-short-films",
	mediaType: "movie",
	language: "zh-CN",
	fetchItems: async () => {
		const items = await fetchDoulistItems("222008");
		return items
			.filter((item) => !EXCLUDE.has(item.title))
			.map((item) => ({ ...item, tmdbId: KNOWN_IDS[item.title] }));
	},
});

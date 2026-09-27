/**
 * Douban doulist "Thai GL" (doulist/162796973).
 * Submission: Thai GL (1713627083dd, zh-CN, tv, poster-list).
 *
 * The list is actively updated, so it refreshes weekly. Douban titles for
 * these series often include a season suffix.
 *
 * Run: bun run scripts/blocks/weekly/douban-thai-gl.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

/** Generic Chinese titles that search binds to an older, non-Thai show. */
const KNOWN_IDS: Record<string, number> = {
	过山车: 282269,
	只属于我: 224211,
	第三者: 320695,
	龙之居: 276285,
	我们的秘密: 253710,
	隐藏的月光: 313982,
	爱的秘密: 220429,
};

/** On the doulist, but not on TMDB yet — drop them instead of a wrong hit. */
const SKIP = new Set([
	"最后一搏",
	"爱恨交织",
	"Yes Maybe No",
	"再爱一次",
	"非你不可",
	"在你身边",
	"残留",
	"她的爱",
	"失控",
	"ก็ว่าจะไม่รัก",
	"I See You",
	"漂亮妻子",
	"Girl Fight",
	"向流星许愿",
]);

await publishBlock({
	submissionId: "1713627083dd",
	blockId: "community-douban-thai-gl",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: async () => {
		const items = await fetchDoulistItems("162796973", { types: ["tv"] });
		return items
			.filter((item) => !SKIP.has(item.title))
			.map((item) => {
				const tmdbId = KNOWN_IDS[item.title];
				return tmdbId ? { ...item, tmdbId } : item;
			});
	},
});

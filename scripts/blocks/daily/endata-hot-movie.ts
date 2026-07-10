/**
 * 艺恩娱数 — 今日电影实时播放量指数榜.
 * Submission: 今日电影实时数据 (5635489902ef, @陈总).
 * Source: https://app.endata.com.cn/DataBox/Video/Home/Index (tvType=1)
 *
 * Run: bun run scripts/blocks/daily/endata-hot-movie.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { ENDATA_TV_TYPE, fetchEndataDayItems } from "../lib/endata.js";

/** Pin known TMDB mismatches (source title → tmdbId). */
const KNOWN_IDS: Record<string, number> = {
	七三一: 1321624,
	重生: 1301470,
};

await publishBlock({
	submissionId: "5635489902ef",
	blockId: "community-endata-hot-movie",
	mediaType: "movie",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: async () => {
		const items = await fetchEndataDayItems(ENDATA_TV_TYPE.movie);
		return items
			.filter((item) => item.title !== "机械军团") // Autómata false-positive; skip
			.map((item) => {
				const tmdbId = KNOWN_IDS[item.title];
				return tmdbId ? { ...item, tmdbId } : item;
			});
	},
});

/**
 * 艺恩娱数 — 今日动漫实时播放量指数榜.
 * Submission: 今日动漫实时数据 (62115b6f1e45, @陈总).
 * Source: https://app.endata.com.cn/DataBox/Video/Home/Index (tvType=11)
 *
 * Run: bun run scripts/blocks/daily/endata-hot-anime.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { TMDB_TV_GENRE_ANIMATION } from "../../../src/crawler/tmdb-enrich.js";
import { ENDATA_TV_TYPE, fetchEndataDayItems } from "../lib/endata.js";

/** Pin known TMDB mismatches (source title → tmdbId). */
const KNOWN_IDS: Record<string, number> = {
	沧元图: 229192,
	剑来第2季: 259537,
	剑来: 259537,
	"鬼灭之刃 柱训练篇": 85937,
	"鬼灭之刃 刀匠村篇": 85937,
	鬼灭之刃: 85937,
	光阴之外: 281233,
	师兄啊师兄: 218642,
	凡人修仙传: 106449,
	海贼王: 37854,
};

await publishBlock({
	submissionId: "62115b6f1e45",
	blockId: "community-endata-hot-anime",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	requireTvGenreIds: [TMDB_TV_GENRE_ANIMATION],
	fetchItems: async () => {
		const items = await fetchEndataDayItems(ENDATA_TV_TYPE.anime);
		return items.map((item) => {
			const tmdbId = KNOWN_IDS[item.title];
			return tmdbId ? { ...item, tmdbId } : item;
		});
	},
});

/**
 * 艺恩娱数 — 今日剧集实时播放量指数榜.
 * Submission: 今日剧集热度榜 (aff7c08fc989, @陈总).
 * Source: https://app.endata.com.cn/DataBox/Video/Home/Index (tvType=2)
 *
 * Run: bun run scripts/blocks/daily/endata-hot-tv.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { ENDATA_TV_TYPE, fetchEndataDayItems } from "../lib/endata.js";

/** Pin known TMDB mismatches (source title → tmdbId). */
const KNOWN_IDS: Record<string, number> = {
	问心2: 233076,
	动物: 214162,
	都市传说: 322353,
	卧底: 110576,
	女王驾到: 235728,
	"格蕾西·达琳迷案第一季": 271823,
	曼达洛人第一季: 82856,
	"曼达洛人第三季（The Mandalorian Season 3）": 82856,
};

await publishBlock({
	submissionId: "aff7c08fc989",
	blockId: "community-endata-hot-tv",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: async () => {
		const items = await fetchEndataDayItems(ENDATA_TV_TYPE.tv);
		return items.map((item) => {
			const tmdbId = KNOWN_IDS[item.title];
			return tmdbId ? { ...item, tmdbId } : item;
		});
	},
});

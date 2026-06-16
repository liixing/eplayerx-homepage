/**
 * Douban doulist "系列电影汇总".
 * Submission: 系列电影汇总 (zh-CN, movie, thumb-list, ranked).
 *
 * Run: bun run scripts/blocks/manual/douban-movie-series.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

const KNOWN_IDS: Record<string, number> = {
	"星球大战2：帝国反击战": 1891,
	"星球大战3：绝地归来": 1892,
	"星球大战前传3：西斯的反击": 1895,
	"蓝白红三部曲之蓝": 108,
	"蓝白红三部曲之白": 109,
	"蓝白红三部曲之红": 110,
};

await publishBlock({
	submissionId: "3e9dc003ee75",
	blockId: "community-douban-movie-series",
	mediaType: "movie",
	language: "zh-CN",
	fetchItems: async () => {
		const items = await fetchDoulistItems("156403834");
		return items.map((item) =>
			KNOWN_IDS[item.title] ? { ...item, tmdbId: KNOWN_IDS[item.title] } : item,
		);
	},
});

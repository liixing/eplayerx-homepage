/**
 * Douban doulist "爱奇艺小逗剧场" (douban.com/doulist/153511631), the iQIYI
 * comedy-drama theater lineup, refreshed monthly as new seasons premiere.
 * Hidden chart feeding the 国内各大剧场 collection block.
 * Submission: 国内各大剧场精选 (zh-CN, tv, thumb-list) by @epx-mac端用户.
 *
 * Run: bun run scripts/blocks/monthly/douban-iqiyi-xiaodou-theater.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

/** Pinned where the bare title hits the wrong TMDB entry. */
const KNOWN_IDS: Record<string, number> = {
	// 2028 drama; bare title search hits the stand-up variety show (261391).
	喜剧之王: 277910,
};

/** Unaired entries whose TMDB pages are still empty placeholders; drop them
 * until they premiere so the block doesn't render broken cards. */
const SKIP_TITLES = new Set(["西游驱魔前传", "我不是诗仙啊", "喜剧之王"]);

await publishBlock({
	submissionId: "f7b808b3821e",
	blockId: "community-iqiyi-xiaodou-theater",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: async () =>
		(await fetchDoulistItems("153511631", { types: ["tv"] }))
			.filter((item) => !SKIP_TITLES.has(item.title))
			.map((item) => ({
				...item,
				tmdbId: KNOWN_IDS[item.title],
			})),
});

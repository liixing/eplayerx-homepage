/**
 * Bangumi anime ranking (bangumi.tv/anime/browser?sort=rank, via api.bgm.tv).
 * Submission: Bangumi 动画排行榜 (zh-CN, poster-list) by @kk.
 *
 * Run: bun run scripts/blocks/monthly/bangumi-top-anime.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { TMDB_TV_GENRE_ANIMATION } from "../../../src/crawler/tmdb-enrich.js";
import { fetchBangumiRankedAnime } from "../lib/bangumi.js";

/** Pinned where zh/ja search fails: sequels whose base entry isn't ranked. */
const KNOWN_IDS: Record<string, number> = {
	明日之丈2: 25117,
	"无职转生～到了异世界就拿出真本事～ 第2部分": 94664,
	"爆漫王。3": 36041,
	"JOJO的奇妙冒险 星尘斗士 埃及篇": 45790,
};

await publishBlock({
	submissionId: "0f9576967b7e",
	blockId: "community-bangumi-top-anime",
	mediaType: "tv",
	language: "zh-CN",
	requireTvGenreIds: [TMDB_TV_GENRE_ANIMATION],
	fetchItems: () => fetchBangumiRankedAnime(100, KNOWN_IDS),
});

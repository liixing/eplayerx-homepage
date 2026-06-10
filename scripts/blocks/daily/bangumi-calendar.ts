/**
 * Bangumi daily broadcast calendar (bangumi.tv/calendar, via api.bgm.tv).
 * Submission: Bangumi 每日放送 (zh-CN, anime, poster-list) by @kk.
 *
 * Publishes the anime airing today (Asia/Shanghai), refreshed daily.
 *
 * Run: bun run scripts/blocks/daily/bangumi-calendar.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { TMDB_TV_GENRE_ANIMATION } from "../../../src/crawler/tmdb-enrich.js";
import { fetchBangumiTodayCalendar } from "../lib/bangumi.js";

/** Pinned for current-season titles whose Bangumi name misses on TMDB. */
const KNOWN_IDS: Record<string, number> = {
	"Re：从零开始的异世界生活 第四季 丧失篇": 65942,
};

await publishBlock({
	submissionId: "3339da8646f3",
	blockId: "community-bangumi-calendar",
	mediaType: "tv",
	language: "zh-CN",
	requireTvGenreIds: [TMDB_TV_GENRE_ANIMATION],
	fetchItems: () => fetchBangumiTodayCalendar(KNOWN_IDS),
});

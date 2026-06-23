/**
 * Douban doulist "豆瓣人气动画" (doulist/42142125).
 * Submission: 豆瓣人气动画 (zh-CN, movie, thumb-list) — corrected to anime/tv.
 *
 * Run: bun run scripts/blocks/manual/douban-popular-anime-doulist.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { TMDB_TV_GENRE_ANIMATION } from "../../../src/crawler/tmdb-enrich.js";
import { fetchDoulistItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "bef5709136dd",
	blockId: "community-douban-popular-anime-doulist",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	requireTvGenreIds: [TMDB_TV_GENRE_ANIMATION],
	fetchItems: () =>
		fetchDoulistItems("42142125", { types: ["tv"], max: 300 }),
});

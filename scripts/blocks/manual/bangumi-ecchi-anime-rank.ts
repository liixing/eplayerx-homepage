/**
 * Bangumi tag "肉番" ranked anime (bangumi.tv/anime/tag/肉番/?sort=rank).
 * Submission: bangumi肉番排行 (zh-CN, movie, thumb-list) — corrected to anime.
 *
 * Run: bun run scripts/blocks/manual/bangumi-ecchi-anime-rank.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { TMDB_TV_GENRE_ANIMATION } from "../../../src/crawler/tmdb-enrich.js";
import { fetchBangumiTaggedAnime } from "../lib/bangumi.js";

await publishBlock({
	submissionId: "7cd4b35f311e",
	blockId: "community-bangumi-ecchi-anime-rank",
	mediaType: "tv",
	language: "zh-CN",
	requireTvGenreIds: [TMDB_TV_GENRE_ANIMATION],
	fetchItems: () => fetchBangumiTaggedAnime("肉番", 120),
});

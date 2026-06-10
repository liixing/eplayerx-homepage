/**
 * MyAnimeList most popular anime (myanimelist.net/topanime.php?type=bypopularity).
 * Submission: MyAnimeList 最流行 (zh-CN, anime, poster-list) by @宇多田光.
 *
 * Run: bun run scripts/blocks/monthly/mal-most-popular.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { TMDB_TV_GENRE_ANIMATION } from "../../../src/crawler/tmdb-enrich.js";
import { fetchMalRankingItems } from "../lib/mal.js";

/** Pinned where romaji search fails: "(TV)" suffix and an EN-ambiguous title. */
const KNOWN_IDS: Record<string, number> = {
	"JoJo no Kimyou na Bouken (TV)": 45790,
	Charlotte: 63145,
};

await publishBlock({
	submissionId: "58f341074ae0",
	blockId: "community-mal-most-popular",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	requireTvGenreIds: [TMDB_TV_GENRE_ANIMATION],
	fetchItems: () =>
		fetchMalRankingItems({ type: "bypopularity", knownIds: KNOWN_IDS }),
});

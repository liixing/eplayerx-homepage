/**
 * Bahamut Sunday new-anime list (acg.gamer.com.tw/quarterly.php?d=7).
 * Submission: 二次元周日新作 (zh-CN, anime, tv).
 *
 * Run: bun run scripts/blocks/weekly/bahamut-sunday.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { TMDB_TV_GENRE_ANIMATION } from "../../../src/crawler/tmdb-enrich.js";
import { fetchBahamutQuarterly } from "../lib/bahamut.js";

await publishBlock({
	submissionId: "b4da421999ef",
	blockId: "community-bahamut-sunday",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	requireTvGenreIds: [TMDB_TV_GENRE_ANIMATION],
	fetchItems: () => fetchBahamutQuarterly(7),
});

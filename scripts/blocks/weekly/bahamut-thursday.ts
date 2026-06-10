/**
 * Bahamut Thursday new-anime list (acg.gamer.com.tw/quarterly.php?d=4).
 * Submission: 二次元周四新作 (zh-CN, anime, tv).
 *
 * Run: bun run scripts/blocks/weekly/bahamut-thursday.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { TMDB_TV_GENRE_ANIMATION } from "../../../src/crawler/tmdb-enrich.js";
import { fetchBahamutQuarterly } from "../lib/bahamut.js";

await publishBlock({
	submissionId: "22bef2c1b766",
	blockId: "community-bahamut-thursday",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	requireTvGenreIds: [TMDB_TV_GENRE_ANIMATION],
	fetchItems: () => fetchBahamutQuarterly(4),
});

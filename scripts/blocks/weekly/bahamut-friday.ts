/**
 * Bahamut Friday new-anime list (acg.gamer.com.tw/quarterly.php?d=5).
 * Submission: 二次元周五新作 (zh-CN, anime, tv).
 *
 * Run: bun run scripts/blocks/weekly/bahamut-friday.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { TMDB_TV_GENRE_ANIMATION } from "../../../src/crawler/tmdb-enrich.js";
import { fetchBahamutQuarterly } from "../lib/bahamut.js";

await publishBlock({
	submissionId: "a7a57083ca62",
	blockId: "community-bahamut-friday",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	requireTvGenreIds: [TMDB_TV_GENRE_ANIMATION],
	fetchItems: () => fetchBahamutQuarterly(5),
});

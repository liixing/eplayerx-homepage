/**
 * Bahamut Tuesday new-anime list (acg.gamer.com.tw/quarterly.php?d=2).
 * Submission: 二次元周二新作 (zh-CN, anime, tv).
 *
 * Run: bun run scripts/blocks/weekly/bahamut-quarterly.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { TMDB_TV_GENRE_ANIMATION } from "../../../src/crawler/tmdb-enrich.js";
import { fetchBahamutQuarterly } from "../lib/bahamut.js";

await publishBlock({
	submissionId: "ae9b098505e1",
	blockId: "community-bahamut-quarterly",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	requireTvGenreIds: [TMDB_TV_GENRE_ANIMATION],
	fetchItems: () => fetchBahamutQuarterly(2),
});

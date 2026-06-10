/**
 * Bahamut Wednesday new-anime list (acg.gamer.com.tw/quarterly.php?d=3).
 * Submission: 二次元周三新作 (zh-CN, anime, tv).
 *
 * Run: bun run scripts/blocks/weekly/bahamut-wednesday.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { TMDB_TV_GENRE_ANIMATION } from "../../../src/crawler/tmdb-enrich.js";
import { fetchBahamutQuarterly } from "../lib/bahamut.js";

await publishBlock({
	submissionId: "64d0ea98bb5d",
	blockId: "community-bahamut-wednesday",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	requireTvGenreIds: [TMDB_TV_GENRE_ANIMATION],
	fetchItems: () => fetchBahamutQuarterly(3),
});

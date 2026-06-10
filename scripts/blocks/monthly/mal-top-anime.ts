/**
 * MyAnimeList top anime ranking (myanimelist.net/topanime.php).
 * Submission: MyAnimeList 总榜 (zh-CN, anime, poster-list).
 *
 * Run: bun run scripts/blocks/monthly/mal-top-anime.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { TMDB_TV_GENRE_ANIMATION } from "../../../src/crawler/tmdb-enrich.js";
import { fetchMalRankingItems } from "../lib/mal.js";

/**
 * TMDB ids pinned where romaji search fails: donghua entries are listed in
 * pinyin (unsearchable on TMDB) and a few sequels lack the base entry in the
 * ranking. Season entries of shows already ranked are left to dedupe.
 */
const KNOWN_IDS: Record<string, number> = {
	"Kingdom 3rd Season": 46437,
	"Mo Dao Zu Shi: Wanjie Pian": 80732,
	"Tian Guan Cifu Er": 112398,
	"Guimi Zhi Zhu: Xiaochou Pian": 232230,
	"Doupo Cangqiong: San Nian Zhi Yue": 79481,
	"Hibike! Euphonium 3": 62564,
	"Ashita no Joe 2": 25117,
};

await publishBlock({
	submissionId: "f234d42fa879",
	blockId: "community-mal-top-anime",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	requireTvGenreIds: [TMDB_TV_GENRE_ANIMATION],
	fetchItems: () => fetchMalRankingItems({ knownIds: KNOWN_IDS }),
});

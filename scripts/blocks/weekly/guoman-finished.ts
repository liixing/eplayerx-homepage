/**
 * Finished Chinese anime (国漫完结榜) from @陈总's GitHub JSON (完结.json).
 * Submission: 国漫完结榜 (16d802870783, zh-CN, anime, thumb-list, rank + overview).
 *
 * Entries already carry TMDB ids. Refreshed weekly with the other 国漫 files.
 *
 * Run: bun run scripts/blocks/weekly/guoman-finished.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { TMDB_TV_GENRE_ANIMATION } from "../../../src/crawler/tmdb-enrich.js";
import { fetchGuomanWeekday } from "../lib/guoman-weekdays.js";

await publishBlock({
	submissionId: "16d802870783",
	blockId: "community-guoman-finished",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	requireTvGenreIds: [TMDB_TV_GENRE_ANIMATION],
	fetchItems: () => fetchGuomanWeekday("完结"),
});

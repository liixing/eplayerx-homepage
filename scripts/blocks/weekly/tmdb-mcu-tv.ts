/**
 * Marvel Cinematic Universe series in first-air-date order.
 * Submission: 漫威mcu电视剧 (2db9ed9159b5, zh-CN, tv, thumb-list, overview).
 *
 * TMDB keyword 180547 sorted by first_air_date.asc. Documentary, talk, and
 * news genres are excluded (making-ofs, Legends, the Doomsday podcast).
 *
 * Run: bun run scripts/blocks/weekly/tmdb-mcu-tv.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import {
	fetchSubmitterToken,
	fetchTmdbDiscoverItems,
} from "../lib/tmdb-discover.js";

const SUBMISSION_ID = "2db9ed9159b5";
const LANGUAGE = "zh-CN";

const token = await fetchSubmitterToken(SUBMISSION_ID);

await publishBlock({
	submissionId: SUBMISSION_ID,
	blockId: "community-tmdb-mcu-tv",
	mediaType: "tv",
	language: LANGUAGE,
	useTmdbTitle: true,
	fetchItems: () =>
		fetchTmdbDiscoverItems(
			token,
			"tv",
			{
				with_keywords: "180547",
				sortBy: "first_air_date.asc",
				// documentary 99, talk 10767, news 10763
				withoutGenres: "99,10767,10763",
			},
			LANGUAGE,
			5,
		),
});

/**
 * Marvel Cinematic Universe movies in release order.
 * Submission: 漫威mcu电影 (2a4ff45f6587, zh-CN, movie, thumb-list, overview).
 *
 * TMDB keyword 180547 sorted by primary_release_date.asc. Runtime is at
 * least 80 minutes so one-shots, making-ofs, and untitled shells stay out.
 *
 * Run: bun run scripts/blocks/weekly/tmdb-mcu-movies.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import {
	fetchSubmitterToken,
	fetchTmdbDiscoverItems,
} from "../lib/tmdb-discover.js";

const SUBMISSION_ID = "2a4ff45f6587";
const LANGUAGE = "zh-CN";

const token = await fetchSubmitterToken(SUBMISSION_ID);

await publishBlock({
	submissionId: SUBMISSION_ID,
	blockId: "community-tmdb-mcu-movies",
	mediaType: "movie",
	language: LANGUAGE,
	useTmdbTitle: true,
	fetchItems: () =>
		fetchTmdbDiscoverItems(
			token,
			"movie",
			{
				with_keywords: "180547",
				sortBy: "primary_release_date.asc",
				runtimeGte: 80,
			},
			LANGUAGE,
			5,
		),
});

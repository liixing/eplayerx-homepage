/**
 * IMDb Most Popular TV Shows (imdb.com/chart/tvmeter).
 * Submission: Most popular TV shows (zh-CN, tv, poster-list, ranked) by @棒冰冰.
 *
 * Reads Trakt's official mirror list (users/justin/lists/imdb-popular-tv-shows,
 * rank asc) since IMDb itself sits behind an AWS WAF JS challenge.
 *
 * Run: bun run scripts/blocks/weekly/imdb-popular-tv.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchTraktListItems } from "../lib/trakt.js";

await publishBlock({
	submissionId: "12a50bd6fde3",
	blockId: "community-imdb-popular-tv",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () =>
		fetchTraktListItems("justin", "imdb-popular-tv-shows", "shows"),
});

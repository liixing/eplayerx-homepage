/**
 * IMDb Most Popular Movies (imdb.com/chart/moviemeter).
 * Submission: Most popular movies (zh-CN, movie, poster-list, ranked) by @棒冰冰.
 *
 * Reads Trakt's official mirror list (users/justin/lists/imdb-popular-movies,
 * rank asc) since IMDb itself sits behind an AWS WAF JS challenge.
 *
 * Run: bun run scripts/blocks/weekly/imdb-popular-movies.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchTraktListItems } from "../lib/trakt.js";

await publishBlock({
	submissionId: "12a50bd6fde3",
	blockId: "community-imdb-popular-movies",
	mediaType: "movie",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () =>
		fetchTraktListItems("justin", "imdb-popular-movies", "movies"),
});

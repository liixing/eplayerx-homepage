/**
 * IMDb Top 250 movies (imdb.com/chart/top).
 * Submission: Top 250 movies (zh-CN, movie, poster-list, ranked) by @棒冰冰.
 *
 * IMDb itself sits behind an AWS WAF JS challenge, so this reads Trakt's
 * official mirror list (users/justin/lists/imdb-top-rated-movies, rank asc)
 * which carries TMDB ids directly.
 *
 * Run: bun run scripts/blocks/monthly/imdb-top250-movies.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchTraktListItems } from "../lib/trakt.js";

await publishBlock({
	submissionId: "7861bfea553e",
	blockId: "community-imdb-top250-movies",
	mediaType: "movie",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () =>
		fetchTraktListItems("justin", "imdb-top-rated-movies", "movies"),
});

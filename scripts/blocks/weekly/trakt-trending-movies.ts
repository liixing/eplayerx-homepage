/**
 * Trakt trending movies via snoak's mirror list (mdblist.com/lists/snoak/trending-movies).
 * Submission: Trakt Trending Movies (zh-CN, movie, poster-list) by @Nacho.
 *
 * Run: bun run scripts/blocks/weekly/trakt-trending-movies.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchTraktListItems } from "../lib/trakt.js";

await publishBlock({
	submissionId: "158c86f828fe",
	blockId: "community-trakt-trending-movies",
	mediaType: "movie",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () =>
		fetchTraktListItems("snoak", "trakt-s-trending-movies", "movies"),
});

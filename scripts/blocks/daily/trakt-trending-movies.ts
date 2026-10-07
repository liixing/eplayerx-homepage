/**
 * Trakt trending movies via the official /movies/trending feed.
 * Submission: Trakt Trending Movies (zh-CN, movie, poster-list) by @Nacho.
 *
 * Run: bun run scripts/blocks/daily/trakt-trending-movies.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchTraktTrendingItems } from "../lib/trakt.js";

await publishBlock({
	submissionId: "158c86f828fe",
	blockId: "community-trakt-trending-movies",
	mediaType: "movie",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () => fetchTraktTrendingItems("movies"),
});

/**
 * Trakt list "Latest releases" (app.trakt.tv/users/garycrawfordgc/lists/latest-releases).
 * Arabic twin of the Latest Movies submission; same author as Latest TV Shows.
 * Submission: Latest Movies (ar-SA, movie, thumb-list) by @OY.
 *
 * List items carry TMDB ids; default order is added-desc (newest first).
 * Submitter mdblist URL had an invalid API key, so this uses the public Trakt list.
 *
 * Run: bun run scripts/blocks/daily/trakt-latest-movies-ar.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchTraktListItems } from "../lib/trakt.js";

await publishBlock({
	submissionId: "725f35cee51e",
	blockId: "community-trakt-latest-movies-ar",
	mediaType: "movie",
	language: "ar-SA",
	useTmdbTitle: true,
	fetchItems: () =>
		fetchTraktListItems("garycrawfordgc", "latest-releases", "movies"),
});

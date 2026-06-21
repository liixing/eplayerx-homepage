/**
 * Trakt list "Latest TV Shows" (app.trakt.tv/users/garycrawfordgc/lists/latest-tv-shows).
 * Submission: Latest TV Shows (zh-CN, tv, poster-list) by @Nacho.
 *
 * List items carry TMDB ids; default order is listed_at desc (newest first).
 *
 * Run: bun run scripts/blocks/weekly/trakt-latest-tv-shows.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchTraktListItems } from "../lib/trakt.js";

await publishBlock({
	submissionId: "23e92663e635",
	blockId: "community-trakt-latest-tv-shows",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () =>
		fetchTraktListItems("garycrawfordgc", "latest-tv-shows", "shows"),
});

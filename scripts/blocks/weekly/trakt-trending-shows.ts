/**
 * Trakt trending shows via snoak's mirror list (mdblist.com/lists/snoak/trakt-s-trending-shows).
 * Submission: Trakt Trending Shows (zh-CN, tv, poster-list) by @Nacho.
 *
 * Run: bun run scripts/blocks/weekly/trakt-trending-shows.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchTraktListItems } from "../lib/trakt.js";

await publishBlock({
	submissionId: "86d1cb5e27ca",
	blockId: "community-trakt-trending-shows",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () =>
		fetchTraktListItems("snoak", "trakt-s-trending-shows", "shows"),
});

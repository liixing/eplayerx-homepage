/**
 * Trakt list "Latest 4K Releases" (app.trakt.tv/users/giladg/lists/latest-4k-releases).
 * Submission: 最新4K电影 (zh-CN, movie, poster-list) by @Nacho.
 *
 * List items carry TMDB ids; default order is added-desc (newest first).
 *
 * Run: bun run scripts/blocks/daily/trakt-latest-4k.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchTraktListItems } from "../lib/trakt.js";

await publishBlock({
	submissionId: "19a8eafff752",
	blockId: "community-trakt-latest-4k",
	mediaType: "movie",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () =>
		fetchTraktListItems("giladg", "latest-4k-releases", "movies"),
});

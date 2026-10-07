/**
 * Trakt trending shows via the official /shows/trending feed.
 * Submission: Trakt Trending Shows (zh-CN, tv, poster-list) by @Nacho.
 *
 * Run: bun run scripts/blocks/daily/trakt-trending-shows.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchTraktTrendingItems } from "../lib/trakt.js";

await publishBlock({
	submissionId: "86d1cb5e27ca",
	blockId: "community-trakt-trending-shows",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () => fetchTraktTrendingItems("shows"),
});

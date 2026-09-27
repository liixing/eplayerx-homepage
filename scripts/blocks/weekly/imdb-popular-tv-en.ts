/**
 * IMDb Most Popular TV Shows (imdb.com/chart/tvmeter), English titles.
 * Submission: Most popular TV shows (fda8de48a9ec, en-US, tv, poster-list).
 *
 * Same Trakt mirror as weekly/imdb-popular-tv.ts (zh-CN). This snapshot
 * stores en-US titles for the English community library.
 *
 * Run: bun run scripts/blocks/weekly/imdb-popular-tv-en.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchTraktListItems } from "../lib/trakt.js";

await publishBlock({
	submissionId: "fda8de48a9ec",
	blockId: "community-imdb-popular-tv-en",
	mediaType: "tv",
	language: "en-US",
	useTmdbTitle: true,
	fetchItems: () =>
		fetchTraktListItems("justin", "imdb-popular-tv-shows", "shows"),
});

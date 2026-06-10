/**
 * Letterboxd official "Top 100 Documentary Miniseries"
 * (letterboxd.com/official/list/top-100-documentary-miniseries).
 * Submission: Letterboxd Top 100 纪录片 (zh-CN, tv, poster-list) by @letterboxd.
 *
 * Entries are docu-series (Planet Earth, Cosmos, ...) so they resolve through
 * TMDB's tv search; the few film-only entries simply drop out.
 *
 * Run: bun run scripts/blocks/monthly/letterboxd-top100-docuseries.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchLetterboxdListItems } from "../lib/letterboxd.js";

await publishBlock({
	submissionId: "7d42ab93c334",
	blockId: "community-letterboxd-top100-docuseries",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () =>
		fetchLetterboxdListItems(
			"https://letterboxd.com/official/list/top-100-documentary-miniseries/",
			1,
		),
});

/**
 * Letterboxd official "Top 100 Documentary Miniseries"
 * (letterboxd.com/official/list/top-100-documentary-miniseries).
 * Submission: Letterboxd Top 100 纪录片 (zh-CN, tv, poster-list) by @letterboxd.
 *
 * Entries are docu-series (Planet Earth, Cosmos, ...) so they resolve through
 * TMDB's tv search; the few film-only entries simply drop out.
 *
 * Run: bun run scripts/blocks/manual/letterboxd-top100-docuseries.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import type { MediaType } from "../../../src/blocks/types.js";
import { fetchLetterboxdListItems } from "../lib/letterboxd.js";

interface KnownItem {
	tmdbId: number;
	mediaType?: MediaType;
}

/** TMDB ids pinned by hand where zh-CN TV search mismatches or drops movie entries. */
const KNOWN_ITEMS: Record<string, KnownItem> = {
	Life: { tmdbId: 16946 },
	"The Hunt": { tmdbId: 64313 },
	"Queen: Days of Our Lives": { tmdbId: 74406, mediaType: "movie" },
	"28 Up": { tmdbId: 20561, mediaType: "movie" },
	"The West": { tmdbId: 30715 },
	"42 Up": { tmdbId: 20565, mediaType: "movie" },
	"49 Up": { tmdbId: 13365, mediaType: "movie" },
	"99": { tmdbId: 251559 },
};

await publishBlock({
	submissionId: "7d42ab93c334",
	blockId: "community-letterboxd-top100-docuseries",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: async () =>
		(await fetchLetterboxdListItems(
			"https://letterboxd.com/official/list/top-100-documentary-miniseries/",
			1,
		)).map((item) => ({
			...item,
			...KNOWN_ITEMS[item.title],
		})),
});

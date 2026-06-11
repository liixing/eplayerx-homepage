/**
 * Letterboxd official "Oscar-Winning Films: Best Picture"
 * (letterboxd.com/oscars/list/oscar-winning-films-best-picture), newest first.
 * Submission: 奥斯卡最佳影片 (zh-CN, movie, hero-list) by @letterboxd.
 *
 * The list only changes once a year; rerun by hand after the Oscars.
 *
 * Run: bun run scripts/blocks/manual/letterboxd-oscar-best-picture.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchLetterboxdListItems } from "../lib/letterboxd.js";

/** TMDB ids pinned by hand where English-title search mismatches. */
const KNOWN_IDS: Record<string, number> = {
	// zh-CN search drifts to "Making Parasite" (2020 documentary).
	Parasite: 496243,
};

await publishBlock({
	submissionId: "140e2dfd4fd6",
	blockId: "community-letterboxd-oscar-best-picture",
	mediaType: "movie",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: async () =>
		(
			await fetchLetterboxdListItems(
				"https://letterboxd.com/oscars/list/oscar-winning-films-best-picture/",
				1,
			)
		).map((item) => ({ ...item, tmdbId: KNOWN_IDS[item.title] })),
});

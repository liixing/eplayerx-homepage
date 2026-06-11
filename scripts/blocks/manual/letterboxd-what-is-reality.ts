/**
 * Letterboxd list "What is reality?" by @tediously_brief
 * (letterboxd.com/tediously_brief/list/what-is-reality).
 * Submission: 惊悚片 (zh-CN, movie, thumb-list).
 *
 * The full list runs ~1,600 films; only the first 3 pages (300 items, list
 * order) are kept so each TMDB enrichment run stays within CI budget.
 *
 * Run: bun run scripts/blocks/manual/letterboxd-what-is-reality.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchLetterboxdListItems } from "../lib/letterboxd.js";

await publishBlock({
	submissionId: "3a02607a5f96",
	blockId: "community-letterboxd-what-is-reality",
	mediaType: "movie",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () =>
		fetchLetterboxdListItems(
			"https://letterboxd.com/tediously_brief/list/what-is-reality/",
		),
});

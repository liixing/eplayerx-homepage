/**
 * Letterboxd official "Top 100 Japanese Films"
 * (letterboxd.com/official/list/top-100-japanese-films).
 * Submission: Letterboxd Top 100 日本电影 (zh-CN, movie, poster-list) by @letterboxd.
 *
 * Run: bun run scripts/blocks/monthly/letterboxd-top100-japanese.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchLetterboxdListItems } from "../lib/letterboxd.js";

await publishBlock({
	submissionId: "3b9617abd395",
	blockId: "community-letterboxd-top100-japanese",
	mediaType: "movie",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () =>
		fetchLetterboxdListItems(
			"https://letterboxd.com/official/list/top-100-japanese-films/",
			1,
		),
});

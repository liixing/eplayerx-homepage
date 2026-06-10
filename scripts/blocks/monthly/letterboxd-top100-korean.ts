/**
 * Letterboxd official "Top 100 South Korean Films"
 * (letterboxd.com/official/list/top-100-south-korean-films).
 * Submission: Letterboxd Top 100 韩国电影 (zh-CN, movie, poster-list) by @Letterboxd.
 *
 * Run: bun run scripts/blocks/monthly/letterboxd-top100-korean.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchLetterboxdListItems } from "../lib/letterboxd.js";

await publishBlock({
	submissionId: "bf92fc295738",
	blockId: "community-letterboxd-top100-korean",
	mediaType: "movie",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () =>
		fetchLetterboxdListItems(
			"https://letterboxd.com/official/list/top-100-south-korean-films/",
			1,
		),
});

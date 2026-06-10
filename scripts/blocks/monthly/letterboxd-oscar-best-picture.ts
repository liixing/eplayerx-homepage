/**
 * Letterboxd official "Oscar-Winning Films: Best Picture"
 * (letterboxd.com/oscars/list/oscar-winning-films-best-picture), newest first.
 * Submission: 奥斯卡最佳影片 (zh-CN, movie, hero-list) by @letterboxd.
 *
 * Run: bun run scripts/blocks/monthly/letterboxd-oscar-best-picture.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchLetterboxdListItems } from "../lib/letterboxd.js";

await publishBlock({
	submissionId: "140e2dfd4fd6",
	blockId: "community-letterboxd-oscar-best-picture",
	mediaType: "movie",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () =>
		fetchLetterboxdListItems(
			"https://letterboxd.com/oscars/list/oscar-winning-films-best-picture/",
			1,
		),
});

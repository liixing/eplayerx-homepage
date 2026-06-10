/**
 * Letterboxd official Festival de Cannes "70 Years of the Palme d'Or"
 * (letterboxd.com/festival_cannes/list/70-years-of-the-palme-dor-70-ans-de-la-palme),
 * newest winner first.
 * Submission: 戛纳金棕榈 (zh-CN, movie, thumb-list) by @letterboxd.
 *
 * Run: bun run scripts/blocks/monthly/letterboxd-palme-dor.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchLetterboxdListItems } from "../lib/letterboxd.js";

await publishBlock({
	submissionId: "f24ecc7d9b61",
	blockId: "community-letterboxd-palme-dor",
	mediaType: "movie",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () =>
		fetchLetterboxdListItems(
			"https://letterboxd.com/festival_cannes/list/70-years-of-the-palme-dor-70-ans-de-la-palme/",
			1,
		),
});

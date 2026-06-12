/**
 * Douban doulists "治愈の动画" (douban.com/doulist/855500 + /doulist/1950208),
 * two curated healing-anime lists merged into one block. Entries mix shows
 * and films, so each item carries its own media type.
 * Submission: 治愈の动画 (zh-CN, anime, poster-list) by @douban.
 *
 * Run: bun run scripts/blocks/manual/douban-healing-anime.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { TMDB_TV_GENRE_ANIMATION } from "../../../src/crawler/tmdb-enrich.js";
import { fetchDoulistItems } from "../lib/douban.js";

const DOULIST_IDS = ["855500", "1950208"];

await publishBlock({
	submissionId: "6ecb047212d2",
	blockId: "community-douban-healing-anime",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	requireTvGenreIds: [TMDB_TV_GENRE_ANIMATION],
	fetchItems: async () => {
		const lists = [];
		for (const id of DOULIST_IDS) {
			lists.push(
				await fetchDoulistItems(id, { types: ["movie", "tv"], max: 150 }),
			);
		}
		return lists.flat();
	},
});

/**
 * Douban doulist "国产剧Top250" (doulist/154192614).
 * Submission: 国产剧Top250 (zh-CN, movie, thumb-list) — corrected to tv.
 *
 * Run: bun run scripts/blocks/manual/douban-domestic-top250-tv.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoulistItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "103ab7137f1a",
	blockId: "community-douban-domestic-top250-tv",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () =>
		fetchDoulistItems("154192614", { types: ["tv"], max: 250 }),
});

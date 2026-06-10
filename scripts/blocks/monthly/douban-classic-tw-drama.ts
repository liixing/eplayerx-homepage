/**
 * Douban subject collection "高分经典台剧榜" (subject_collection/ECBI5EL6A).
 * Submission: 豆瓣：高分经典台剧榜 (zh-CN, tv, poster-list).
 *
 * Douban titles carry season suffixes, so the TMDB localized show title
 * is stored instead of the scraped one.
 *
 * Run: bun run scripts/blocks/monthly/douban-classic-tw-drama.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchSubjectCollectionItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "d33422ad2a27",
	blockId: "community-douban-classic-tw-drama",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () => fetchSubjectCollectionItems("ECBI5EL6A"),
});

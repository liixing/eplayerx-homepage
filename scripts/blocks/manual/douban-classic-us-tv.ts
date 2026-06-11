/**
 * Douban subject collection "高分经典美剧榜" (subject_collection/ECVACWVGI).
 * Submission: 豆瓣：高分经典美剧榜 (zh-CN, tv, thumb-list).
 *
 * Douban titles carry season suffixes ("老友记 第一季"), so the TMDB
 * localized show title is stored instead of the scraped one.
 *
 * Run: bun run scripts/blocks/manual/douban-classic-us-tv.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchSubjectCollectionItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "f35ebaf5e65b",
	blockId: "community-douban-classic-us-tv",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () => fetchSubjectCollectionItems("ECVACWVGI"),
});

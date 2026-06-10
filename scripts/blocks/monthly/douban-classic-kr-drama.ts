/**
 * Douban subject collection "高分经典韩剧榜" (subject_collection/EC6EC5GBQ).
 * Submission: 豆瓣：高分经典韩剧榜 (zh-CN, tv, poster-list).
 *
 * Douban titles carry season suffixes, so the TMDB localized show title
 * is stored instead of the scraped one.
 *
 * Run: bun run scripts/blocks/monthly/douban-classic-kr-drama.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchSubjectCollectionItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "eff30429d55e",
	blockId: "community-douban-classic-kr-drama",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () => fetchSubjectCollectionItems("EC6EC5GBQ"),
});

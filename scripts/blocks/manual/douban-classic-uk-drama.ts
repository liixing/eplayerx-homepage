/**
 * Douban subject collection "高分经典英剧榜" (subject_collection/ECVACXBWI).
 * Submission: 豆瓣：高分经典英剧榜 (zh-CN, tv, poster-list).
 *
 * Douban titles carry season suffixes ("神探夏洛克 第一季"), so the TMDB
 * localized show title is stored instead of the scraped one.
 *
 * Run: bun run scripts/blocks/manual/douban-classic-uk-drama.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchSubjectCollectionItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "bbc39177f38d",
	blockId: "community-douban-classic-uk-drama",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () => fetchSubjectCollectionItems("ECVACXBWI"),
});

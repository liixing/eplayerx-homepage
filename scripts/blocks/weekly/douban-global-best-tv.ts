/**
 * Douban "全球口碑剧集榜" (subject_collection/tv_global_best_weekly), a weekly
 * ranked list of the best-reviewed TV series worldwide (~10 entries).
 * Submission: 全球口碑剧集榜 (zh-CN, hero-list, rank) by @冬天等雨.
 *
 * Douban titles carry season suffixes, so the TMDB localized show title
 * is stored instead of the scraped one.
 *
 * Run: bun run scripts/blocks/weekly/douban-global-best-tv.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchSubjectCollectionItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "dfd1f1b40240",
	blockId: "community-douban-global-best-tv",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () => fetchSubjectCollectionItems("tv_global_best_weekly"),
});

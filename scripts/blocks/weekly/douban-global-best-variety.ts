/**
 * Douban "一周国外口碑综艺榜" (subject_collection/show_global_best_weekly).
 * Submission: 国外口碑综艺榜 (zh-CN, thumb-list, rank+overview).
 *
 * Douban titles often carry season suffixes, so the TMDB localized show
 * title is stored instead of the scraped one.
 *
 * Run: bun run scripts/blocks/weekly/douban-global-best-variety.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchSubjectCollectionItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "239f838a6f85",
	blockId: "community-douban-global-best-variety",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () => fetchSubjectCollectionItems("show_global_best_weekly"),
});

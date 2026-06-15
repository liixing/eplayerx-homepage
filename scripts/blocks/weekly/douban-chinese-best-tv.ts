/**
 * Douban "华语口碑剧集榜" (subject_collection/tv_chinese_best_weekly), a weekly
 * ranked list of the best-reviewed Chinese-language TV series.
 * Submission: 华语口碑剧集榜 (zh-CN, tv, thumb-list, rank + overview).
 *
 * Douban titles can carry season suffixes, so the TMDB localized show title
 * is stored instead of the scraped one.
 *
 * Run: bun run scripts/blocks/weekly/douban-chinese-best-tv.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchSubjectCollectionItems } from "../lib/douban.js";

// TMDB search currently resolves "COURT!" to the unrelated "Night Court".
const SKIPPED_TITLES = new Set(["COURT!"]);

await publishBlock({
	submissionId: "683e65d6845e",
	blockId: "community-douban-chinese-best-tv",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: async () =>
		(await fetchSubjectCollectionItems("tv_chinese_best_weekly")).filter(
			(item) => !SKIPPED_TITLES.has(item.title),
		),
});

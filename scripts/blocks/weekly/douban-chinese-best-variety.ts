/**
 * Douban "一周国内口碑综艺榜" (subject_collection/show_chinese_best_weekly).
 * Submission: 国内口碑综艺榜 (zh-CN, thumb-list, rank+overview) by @御天神暝.
 *
 * Douban titles often carry season suffixes, so the TMDB localized show
 * title is stored instead of the scraped one.
 *
 * Run: bun run scripts/blocks/weekly/douban-chinese-best-variety.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchSubjectCollectionItems } from "../lib/douban.js";

// Simplified Douban title misses TMDB's traditional-Chinese listing.
const KNOWN_IDS: Record<string, number> = {
	恋爱女子宿舍: 313337,
};

await publishBlock({
	submissionId: "88c221105cdf",
	blockId: "community-douban-chinese-best-variety",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: async () => {
		const items = await fetchSubjectCollectionItems("show_chinese_best_weekly");
		return items.map((item) => {
			const tmdbId = KNOWN_IDS[item.title];
			return tmdbId ? { ...item, tmdbId } : item;
		});
	},
});

/**
 * Douban "近期热门综艺节目" (subject_collection/tv_variety_show), a daily
 * refreshed ranked list of trending variety shows.
 *
 * Run: bun run scripts/blocks/daily/douban-hot-variety-shows.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchSubjectCollectionItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "2653687ef66a",
	blockId: "community-douban-hot-variety-shows",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () => fetchSubjectCollectionItems("tv_variety_show"),
});

/**
 * Douban "近期热门韩剧" (subject_collection/tv_korean), a daily refreshed
 * ranked list of trending Korean TV series.
 *
 * Run: bun run scripts/blocks/daily/douban-hot-korean-tv.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchSubjectCollectionItems } from "../lib/douban.js";

const SKIPPED_TITLES = new Set(["逆转"]);

await publishBlock({
	submissionId: "67e5d52316d1",
	blockId: "community-douban-hot-korean-tv",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: async () =>
		(await fetchSubjectCollectionItems("tv_korean")).filter(
			(item) => !SKIPPED_TITLES.has(item.title),
		),
});

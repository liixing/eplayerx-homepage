/**
 * Douban "近期热门国产剧" (subject_collection/tv_domestic), a daily refreshed
 * ranked list of trending Mainland Chinese TV series.
 *
 * Run: bun run scripts/blocks/daily/douban-hot-domestic-tv.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchSubjectCollectionItems } from "../lib/douban.js";

const SKIPPED_TITLES = new Set(["COURT!"]);

await publishBlock({
	submissionId: "4e79a6a50f57",
	blockId: "community-douban-hot-domestic-tv",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: async () =>
		(await fetchSubjectCollectionItems("tv_domestic")).filter(
			(item) => !SKIPPED_TITLES.has(item.title),
		),
});

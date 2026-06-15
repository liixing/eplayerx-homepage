/**
 * Douban "近期热门日剧" (subject_collection/tv_japanese), a daily refreshed
 * ranked list of trending Japanese TV series.
 *
 * Run: bun run scripts/blocks/daily/douban-hot-japanese-tv.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchSubjectCollectionItems } from "../lib/douban.js";

await publishBlock({
	submissionId: "98e250933084",
	blockId: "community-douban-hot-japanese-tv",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: () => fetchSubjectCollectionItems("tv_japanese"),
});

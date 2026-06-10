/**
 * Douban 2025 annual movie lists (movie.douban.com/annual/2025).
 * Submission: 豆瓣2025年度电影榜单 (zh-CN, movie, poster-list, ranked) by @棒冰冰.
 *
 * The annual page is driven by /j/neu/page/33/ whose movie widgets reference
 * rexxar subject collections; the main movie lists are concatenated:
 * 评分最高华语电影 (16245) + 评分最高外语电影 (16246) + 冷门佳片 (16247).
 *
 * Run: bun run scripts/blocks/manual/douban-annual-2025.ts
 */

import {
	publishBlock,
	type PublishItem,
} from "../../../src/blocks/publish.js";
import { fetchSubjectCollectionItems } from "../lib/douban.js";

const COLLECTION_IDS = ["16245", "16246", "16247"];

async function fetchItems(): Promise<PublishItem[]> {
	const items: PublishItem[] = [];
	for (const id of COLLECTION_IDS) {
		items.push(...(await fetchSubjectCollectionItems(id, 50)));
	}
	return items;
}

await publishBlock({
	submissionId: "31763aa0dbc6",
	blockId: "community-douban-annual-2025",
	mediaType: "movie",
	language: "zh-CN",
	fetchItems,
});

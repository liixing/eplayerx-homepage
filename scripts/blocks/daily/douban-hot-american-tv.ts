/**
 * Douban "近期热门美剧" (subject_collection/tv_american), a daily refreshed
 * ranked list of trending American TV series.
 *
 * Run: bun run scripts/blocks/daily/douban-hot-american-tv.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchSubjectCollectionItems } from "../lib/douban.js";

const KNOWN_IDS: Record<string, number> = {
	"海贼王(真人版) 第二季": 111110,
	"犯罪心理：演变 第十九季": 4057,
	"四季情 第二季": 243316,
};

await publishBlock({
	submissionId: "da4aae6907e1",
	blockId: "community-douban-hot-american-tv",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: async () =>
		(await fetchSubjectCollectionItems("tv_american")).map((item) => ({
			...item,
			tmdbId: KNOWN_IDS[item.title],
		})),
});

/**
 * Douban "近期热门美剧" (subject_collection/tv_american), a daily refreshed
 * ranked list of trending Western TV series (also UK, Europe and the Americas).
 *
 * Run: bun run scripts/blocks/daily/douban-hot-american-tv.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchSubjectCollectionItems } from "../lib/douban.js";

const KNOWN_IDS: Record<string, number> = {
	"流人 第六季": 95480,
	"足球教练 第四季": 97546,
	"龙之家族 第三季": 94997,
	"海贼王(真人版) 第二季": 111110,
	"犯罪心理：演变 第十九季": 4057,
	"四季情 第二季": 243316,
};

await publishBlock({
	submissionId: "da4aae6907e1",
	blockId: "community-douban-hot-american-tv",
	mediaType: "tv",
	language: "zh-CN",
	// tv_american includes British, European, Canadian and Latin American shows.
	// ponytail: explicit source-region allowlist; extend if Douban adds another origin.
	requireOriginCountries: [
		"US",
		"GB",
		"CA",
		"AU",
		"NZ",
		"IE",
		"DE",
		"FR",
		"IT",
		"ES",
		"PT",
		"NL",
		"BE",
		"CH",
		"AT",
		"SE",
		"NO",
		"DK",
		"FI",
		"IS",
		"PL",
		"CZ",
		"HU",
		"RO",
		"GR",
		"MX",
		"BR",
		"AR",
	],
	useTmdbTitle: true,
	fetchItems: async () =>
		(await fetchSubjectCollectionItems("tv_american")).map((item) => ({
			...item,
			tmdbId: KNOWN_IDS[item.title],
		})),
});

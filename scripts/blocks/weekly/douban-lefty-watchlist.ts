import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchDoubanWishlistItems } from "../lib/douban-wishlist.js";

// Include media type and year because this list contains remakes and adaptations.
const KNOWN_IDS: Record<string, number> = {
	"tv/傲慢与偏见/2026": 288672,
	"tv/此生为傲/2026": 315610,
	"tv/校园之外 第二季/2027": 273240,
	"movie/设备/2028": 1658341,
	"movie/无双/2025": 1245347,
	"movie/僵尸/2013": 210911,
	"tv/黑鸟/2022": 155537,
	"tv/一天/2024": 240667,
	"tv/龙之家族 第三季/2026": 94997,
	"tv/你 第一季/2018": 78191,
	"tv/无耻之徒 第一季/2004": 1906,
	"tv/奇迹/2025": 292277,
	"tv/寻 第一季/2014": 57774,
	"tv/星期三 第三季/2027": 119051,
	"tv/流人 第一季/2022": 95480,
	"tv/小公主/1987": 2953,
	"tv/同窗会/1993": 252919,
	"tv/风味人间5·香料传奇/2024": 83670,
	"movie/爱，简单/2014": 237791,
	"tv/白色巨塔/2003": 38242,
	"tv/灵魂摆渡2/2015": 75480,
	"tv/女巫/2020": 107324,
	"tv/史前星球 第一季/2022": 95171,
};

await publishBlock({
	submissionId: "8be4f031ec56",
	blockId: "community-douban-lefty-watchlist",
	mediaType: "movie",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems: async () =>
		(await fetchDoubanWishlistItems("221870436"))
			// TMDB only returns an unrelated music film for this animated short.
			.filter((item) => item.title !== "请不要再虐待你的器官了")
			.map((item) => ({
				...item,
				tmdbId: KNOWN_IDS[`${item.mediaType}/${item.title}/${item.year}`],
			})),
});

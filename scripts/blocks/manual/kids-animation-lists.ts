import { type PublishItem, publishBlock } from "../../../src/blocks/publish.js";

const BLOCKS: {
	submissionId: string;
	blockId: string;
	items: PublishItem[];
}[] = [
	{
		submissionId: "404e397c09ac",
		blockId: "community-animation-watchlist",
		items: [
			{ title: "疯狂动物城", tmdbId: 269149, mediaType: "movie" },
			{ title: "头脑特工队", tmdbId: 150540, mediaType: "movie" },
			{ title: "寻梦环游记", tmdbId: 354912, mediaType: "movie" },
			{ title: "飞屋环游记", tmdbId: 14160, mediaType: "movie" },
			{ title: "超能陆战队", tmdbId: 177572, mediaType: "movie" },
			{ title: "驯龙高手", tmdbId: 10191, mediaType: "movie" },
			{ title: "神偷奶爸", tmdbId: 20352, mediaType: "movie" },
			{ title: "功夫熊猫", tmdbId: 9502, mediaType: "movie" },
			{ title: "海洋奇缘", tmdbId: 277834, mediaType: "movie" },
			{ title: "花木兰", tmdbId: 10674, mediaType: "movie" },
			{ title: "玩具总动员", tmdbId: 862, mediaType: "movie" },
			{ title: "怪兽电力公司", tmdbId: 585, mediaType: "movie" },
			{ title: "蜘蛛侠：平行宇宙", tmdbId: 324857, mediaType: "movie" },
			{ title: "熊出没", tmdbId: 202329, mediaType: "tv" },
			{ title: "喜羊羊与灰太狼", tmdbId: 6732, mediaType: "tv" },
			{ title: "葫芦兄弟", tmdbId: 1319, mediaType: "tv" },
			{ title: "黑猫警长", tmdbId: 91068, mediaType: "tv" },
			{ title: "名侦探柯南", tmdbId: 30983, mediaType: "tv" },
			{ title: "哆啦A梦", tmdbId: 65733, mediaType: "tv" },
			{ title: "樱桃小丸子", tmdbId: 57775, mediaType: "tv" },
		],
	},
	{
		submissionId: "2b86f0140e23",
		blockId: "community-kids-animation-watchlist",
		items: [
			{ title: "小猪佩奇", tmdbId: 12225, mediaType: "tv" },
			{ title: "汪汪队立大功", tmdbId: 57532, mediaType: "tv" },
			{ title: "萌鸡小队", tmdbId: 85087, mediaType: "tv" },
			{ title: "海底小纵队", tmdbId: 37472, mediaType: "tv" },
			{ title: "超级飞侠", tmdbId: 71026, mediaType: "tv" },
			{ title: "大头儿子和小头爸爸", tmdbId: 132849, mediaType: "tv" },
			{ title: "变形警车珀利", tmdbId: 61194, mediaType: "tv" },
			{ title: "小马宝莉", tmdbId: 33765, mediaType: "tv" },
			{ title: "爱探险的朵拉", tmdbId: 79, mediaType: "tv" },
			{ title: "米奇妙妙屋", tmdbId: 3934, mediaType: "tv" },
			{ title: "花园宝宝", tmdbId: 3048, mediaType: "tv" },
			{ title: "天线宝宝", tmdbId: 1682, mediaType: "tv" },
			{ title: "巴布工程师", tmdbId: 10938, mediaType: "tv" },
			{ title: "托马斯和朋友们", tmdbId: 2304, mediaType: "tv" },
			{ title: "蓝色小考拉", tmdbId: 105996, mediaType: "tv" },
			// 小猪小象 has no identifiable movie or TV entry on TMDB.
			{ title: "小熊维尼", tmdbId: 51162, mediaType: "movie" },
			{ title: "狮子王", tmdbId: 8587, mediaType: "movie" },
			{ title: "小鹿斑比", tmdbId: 3170, mediaType: "movie" },
			{ title: "冰雪奇缘", tmdbId: 109445, mediaType: "movie" },
		],
	},
];

for (const { items, ...block } of BLOCKS) {
	await publishBlock({
		...block,
		mediaType: "tv",
		language: "zh-CN",
		useTmdbTitle: true,
		fetchItems: async () => items,
	});
}

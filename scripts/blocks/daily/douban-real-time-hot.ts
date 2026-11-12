import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchSubjectCollectionItems } from "../lib/douban.js";

const KNOWN_IDS: Record<string, number> = {
	// TMDB dates the documentary by its 2026 release, while Douban lists 2024.
	爷爷奶奶那些事: 1325871,
	// TMDB has two 2026 films named The Odyssey.
	奥德赛: 1368337,
};

const BLOCKS = [
	{
		submissionId: "ef4b4576fd70",
		blockId: "community-douban-real-time-hot-tv",
		mediaType: "tv",
		useTmdbTitle: true,
	},
	{
		submissionId: "f80f82e9005a",
		blockId: "community-douban-real-time-hot-movie",
		mediaType: "movie",
	},
] as const;

for (const block of BLOCKS) {
	await publishBlock({
		...block,
		language: "zh-CN",
		fetchItems: async () => {
			const items = await fetchSubjectCollectionItems(
				`${block.mediaType}_real_time_hotest`,
			);
			return items
				.filter((item) => item.mediaType === block.mediaType)
				.map((item) => ({
					...item,
					tmdbId:
						block.mediaType === "movie" ? KNOWN_IDS[item.title] : undefined,
				}));
		},
	});
}

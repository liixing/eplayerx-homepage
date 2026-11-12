import { publishBlock } from "../../../src/blocks/publish.js";
import {
	type DiscoverFilter,
	fetchSubmitterToken,
	fetchTmdbDiscoverItems,
} from "../lib/tmdb-discover.js";

const BLOCKS: {
	submissionId: string;
	blockId: string;
	mediaType: "movie" | "tv";
	filter: DiscoverFilter;
}[] = [
	{
		submissionId: "7dd16dd5f269",
		blockId: "community-tmdb-school-age-tv",
		mediaType: "tv",
		filter: {
			with_genres: "16,10762",
			voteCountGte: 50,
			voteAverageGte: 6.5,
			withoutGenres: "10764,10767",
		},
	},
	{
		submissionId: "30fe6c2fd197",
		blockId: "community-tmdb-family-animation-movies",
		mediaType: "movie",
		filter: {
			with_genres: "16,10751",
			certificationCountry: "US",
			certificationLte: "PG",
			voteCountGte: 500,
			voteAverageGte: 6.5,
			withoutGenres: "27,53,80,10752",
		},
	},
	{
		submissionId: "4f63de0bb216",
		blockId: "community-tmdb-chinese-kids-tv",
		mediaType: "tv",
		filter: {
			with_genres: "10762",
			withOriginalLanguage: "zh",
			voteCountGte: 10,
		},
	},
	{
		submissionId: "fd7511ee3695",
		blockId: "community-tmdb-preschool-tv",
		mediaType: "tv",
		filter: {
			with_genres: "10762",
			voteCountGte: 30,
			withoutGenres: "10764,10767",
		},
	},
	{
		submissionId: "0a35e1e2bc8d",
		blockId: "community-tmdb-preschool-animation-movies",
		mediaType: "movie",
		filter: {
			with_genres: "16",
			certificationCountry: "US",
			certificationLte: "G",
			voteCountGte: 300,
			voteAverageGte: 6.5,
			withoutGenres: "27,53,80,10752",
		},
	},
];

for (const { filter, ...block } of BLOCKS) {
	const token = await fetchSubmitterToken(block.submissionId);
	await publishBlock({
		...block,
		language: "zh-CN",
		useTmdbTitle: true,
		fetchItems: () =>
			fetchTmdbDiscoverItems(token, block.mediaType, filter, "zh-CN"),
	});
}

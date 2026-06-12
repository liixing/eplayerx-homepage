/**
 * Douban "高分经典XX片榜" genre collections — 20 movie genre charts from the
 * Douban app's classic film rankings, published as one block per genre and
 * grouped into the "豆瓣高分经典电影合集" collection (movie counterpart of the
 * 7-country classic drama collection in douban-classic-*-drama.ts).
 *
 * Each genre maps to its own /admin submission (all by @Fantastic). The
 * adventure submission carried a broken dispatch URL; its real collection id
 * is film_genre_49 (verified against the rexxar API).
 *
 * Run: bun run scripts/blocks/manual/douban-classic-movie-genres.ts
 * Optionally pass genre slugs to republish a subset, e.g.
 *   bun run scripts/blocks/manual/douban-classic-movie-genres.ts love comedy
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import { fetchSubjectCollectionItems } from "../lib/douban.js";

interface GenreChart {
	slug: string;
	collectionId: string;
	submissionId: string;
}

// Listed in submission order (oldest first): the submitter started with
// comedy and worked through the genre tabs.
const CHARTS: GenreChart[] = [
	{ slug: "comedy", collectionId: "movie_comedy", submissionId: "12a50bd6fde3" },
	{ slug: "action", collectionId: "movie_action", submissionId: "a1169ddd638e" },
	{ slug: "love", collectionId: "movie_love", submissionId: "7b2b283c1db3" },
	{ slug: "scifi", collectionId: "movie_scifi", submissionId: "e5576273e2e4" },
	{ slug: "animation", collectionId: "film_genre_31", submissionId: "3190318f625e" },
	{ slug: "mystery", collectionId: "film_genre_32", submissionId: "ac6fe815f3f8" },
	{ slug: "thriller", collectionId: "film_genre_33", submissionId: "01b4ff751985" },
	{ slug: "horror", collectionId: "film_genre_34", submissionId: "e170e08f125f" },
	{ slug: "crime", collectionId: "film_genre_46", submissionId: "ee0b1c0946fa" },
	{ slug: "music", collectionId: "film_genre_39", submissionId: "f3cc95d3de75" },
	{ slug: "musical", collectionId: "film_genre_40", submissionId: "236f2f13b8d1" },
	{ slug: "biopic", collectionId: "film_genre_43", submissionId: "6b8bd9f25f82" },
	{ slug: "history", collectionId: "film_genre_44", submissionId: "77e7522e4d48" },
	{ slug: "war", collectionId: "film_genre_45", submissionId: "e682c3541d97" },
	{ slug: "western", collectionId: "film_genre_47", submissionId: "b31185eb6481" },
	{ slug: "fantasy", collectionId: "film_genre_48", submissionId: "5ffd2f5be58c" },
	{ slug: "adventure", collectionId: "film_genre_49", submissionId: "3555dd59f99e" },
	{ slug: "disaster", collectionId: "natural_disasters", submissionId: "ea08c8fdcdd0" },
	{ slug: "wuxia", collectionId: "film_genre_50", submissionId: "3791ab20a6d1" },
	{ slug: "erotic", collectionId: "film_genre_37", submissionId: "9e5f982d9975" },
];

// Pin ids where Douban titles match the wrong TMDB entry.
const KNOWN_IDS: Record<string, number> = {};

const only = new Set(process.argv.slice(2));
const selected = only.size
	? CHARTS.filter((chart) => only.has(chart.slug))
	: CHARTS;

for (const chart of selected) {
	await publishBlock({
		submissionId: chart.submissionId,
		blockId: `community-douban-classic-${chart.slug}-movies`,
		mediaType: "movie",
		language: "zh-CN",
		fetchItems: async () => {
			const items = await fetchSubjectCollectionItems(chart.collectionId);
			return items.map((item) =>
				KNOWN_IDS[item.title]
					? { ...item, tmdbId: KNOWN_IDS[item.title] }
					: item,
			);
		},
	});
}

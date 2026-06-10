/**
 * AniChart current-season anime (anichart.net, via the AniList GraphQL API
 * that powers it), sorted by popularity.
 * Submission: 季度新番 (zh-CN, anime, poster-list) by @kk.
 *
 * Run: bun run scripts/blocks/weekly/anichart-seasonal.ts
 */

import {
	type PublishItem,
	publishBlock,
} from "../../../src/blocks/publish.js";
import { TMDB_TV_GENRE_ANIMATION } from "../../../src/crawler/tmdb-enrich.js";

const GRAPHQL_URL = "https://graphql.anilist.co";
const MAX_ITEMS = 50;

const QUERY = `query($season:MediaSeason!,$seasonYear:Int!,$perPage:Int!){
	Page(page:1,perPage:$perPage){
		media(season:$season,seasonYear:$seasonYear,type:ANIME,sort:POPULARITY_DESC,format_in:[TV,TV_SHORT,ONA]){
			title{native romaji}
		}
	}
}`;

interface AniListMedia {
	title?: { romaji?: string; native?: string };
}

interface AniListResponse {
	data?: { Page?: { media?: AniListMedia[] } };
}

function currentSeason(): { season: string; seasonYear: number } {
	const now = new Date(
		new Date().toLocaleString("en-US", { timeZone: "Asia/Shanghai" }),
	);
	const seasons = ["WINTER", "SPRING", "SUMMER", "FALL"] as const;
	return {
		season: seasons[Math.floor(now.getMonth() / 3)],
		seasonYear: now.getFullYear(),
	};
}

async function fetchItems(): Promise<PublishItem[]> {
	const { season, seasonYear } = currentSeason();
	console.log(`📅 AniChart season: ${season} ${seasonYear}`);
	const res = await fetch(GRAPHQL_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json", Accept: "application/json" },
		body: JSON.stringify({
			query: QUERY,
			variables: { season, seasonYear, perPage: MAX_ITEMS },
		}),
	});
	if (!res.ok) {
		throw new Error(`AniList GraphQL error: ${res.status}`);
	}
	const media = ((await res.json()) as AniListResponse).data?.Page?.media ?? [];

	const items: PublishItem[] = [];
	for (const m of media) {
		const native = m.title?.native;
		const romaji = m.title?.romaji;
		const title = native || romaji;
		if (!title) continue;
		items.push({
			title,
			...(romaji && romaji !== title ? { altTitles: [romaji] } : {}),
		});
	}
	return items;
}

await publishBlock({
	submissionId: "e75de07c203f",
	blockId: "community-anichart-seasonal",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	requireTvGenreIds: [TMDB_TV_GENRE_ANIMATION],
	fetchItems,
});

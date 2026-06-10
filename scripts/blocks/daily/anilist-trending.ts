/**
 * AniList trending anime (anilist.co/search/anime/trending, via GraphQL).
 * Submission: AniList Trending 动画趋势榜 (zh-CN, poster-list) by @kk.
 *
 * Run: bun run scripts/blocks/daily/anilist-trending.ts
 */

import {
	type PublishItem,
	publishBlock,
} from "../../../src/blocks/publish.js";
import { TMDB_TV_GENRE_ANIMATION } from "../../../src/crawler/tmdb-enrich.js";

const GRAPHQL_URL = "https://graphql.anilist.co";
const MAX_ITEMS = 50;
const SERIES_FORMATS = new Set(["TV", "TV_SHORT", "ONA"]);

const QUERY = `query($perPage:Int!){
	Page(page:1,perPage:$perPage){
		media(sort:TRENDING_DESC,type:ANIME){
			format
			title{romaji native}
		}
	}
}`;

interface AniListMedia {
	format?: string;
	title?: { romaji?: string; native?: string };
}

interface AniListResponse {
	data?: { Page?: { media?: AniListMedia[] } };
}

async function fetchItems(): Promise<PublishItem[]> {
	const res = await fetch(GRAPHQL_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json", Accept: "application/json" },
		// Over-fetch: movie/OVA formats get filtered out below.
		body: JSON.stringify({ query: QUERY, variables: { perPage: 100 } }),
	});
	if (!res.ok) {
		throw new Error(`AniList GraphQL error: ${res.status}`);
	}
	const media = ((await res.json()) as AniListResponse).data?.Page?.media ?? [];

	const items: PublishItem[] = [];
	for (const m of media) {
		if (!SERIES_FORMATS.has(m.format ?? "")) continue;
		const native = m.title?.native;
		const romaji = m.title?.romaji;
		const title = native || romaji;
		if (!title) continue;
		items.push({
			title,
			...(romaji && romaji !== title ? { altTitles: [romaji] } : {}),
		});
		if (items.length >= MAX_ITEMS) break;
	}
	return items;
}

await publishBlock({
	submissionId: "0b91e1b4985e",
	blockId: "community-anilist-trending",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	requireTvGenreIds: [TMDB_TV_GENRE_ANIMATION],
	fetchItems,
});

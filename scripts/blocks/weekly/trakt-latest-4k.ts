/**
 * Trakt list "Latest 4K Releases" (app.trakt.tv/users/giladg/lists/latest-4k-releases).
 * Submission: 最新4K电影 (zh-CN, movie, poster-list) by @Nacho.
 *
 * Uses the Trakt web app's public client id (shipped in the app.trakt.tv JS
 * bundle) to read the public list; items carry TMDB ids so no title search.
 *
 * Run: bun run scripts/blocks/weekly/trakt-latest-4k.ts
 */

import {
	publishBlock,
	type PublishItem,
} from "../../../src/blocks/publish.js";

const LIST_ITEMS_URL =
	"https://api.trakt.tv/users/giladg/lists/latest-4k-releases/items/movies";
// Public web-app client id from the app.trakt.tv bundle (not a secret).
const TRAKT_CLIENT_ID =
	"201dc70c5ec6af530f12f079ea1922733f6e1085ad7b02f36d8e011b75bcea7d";
const PAGE_LIMIT = 100;
const MAX_PAGES = 5;

interface TraktListItem {
	type: string;
	movie?: {
		title?: string;
		ids?: { tmdb?: number };
	};
}

/** List items in API order (added desc), newest releases first. */
async function fetchItems(): Promise<PublishItem[]> {
	const items: PublishItem[] = [];
	for (let page = 1; page <= MAX_PAGES; page++) {
		const res = await fetch(
			`${LIST_ITEMS_URL}?page=${page}&limit=${PAGE_LIMIT}`,
			{
				headers: {
					"Content-Type": "application/json",
					"trakt-api-version": "2",
					"trakt-api-key": TRAKT_CLIENT_ID,
				},
			},
		);
		if (!res.ok) {
			throw new Error(`Trakt API error: ${res.status}`);
		}
		const rows = (await res.json()) as TraktListItem[];
		for (const row of rows) {
			const tmdbId = row.movie?.ids?.tmdb;
			if (row.type !== "movie" || !row.movie?.title || !tmdbId) continue;
			items.push({ title: row.movie.title, tmdbId });
		}
		if (rows.length < PAGE_LIMIT) break;
	}
	return items;
}

await publishBlock({
	submissionId: "19a8eafff752",
	blockId: "community-trakt-latest-4k",
	mediaType: "movie",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems,
});

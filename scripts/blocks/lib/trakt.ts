/**
 * Shared fetcher for public Trakt lists via api.trakt.tv.
 *
 * Authenticated with the Trakt web app's public client id (shipped in the
 * app.trakt.tv JS bundle, not a secret). List items carry TMDB ids, so
 * publishing skips title search entirely.
 */

import type { PublishItem } from "../../../src/blocks/publish.js";
import { fetchWithRetry } from "./http.js";

const API_BASE = "https://api.trakt.tv";
// Public web-app client id from the app.trakt.tv bundle (not a secret).
const TRAKT_CLIENT_ID =
	"201dc70c5ec6af530f12f079ea1922733f6e1085ad7b02f36d8e011b75bcea7d";
const PAGE_LIMIT = 100;
const MAX_PAGES = 5;

interface TraktListItem {
	type: string;
	movie?: { title?: string; ids?: { tmdb?: number } };
	show?: { title?: string; ids?: { tmdb?: number } };
}

/** Items of a user's public list, in the list's default order. */
export async function fetchTraktListItems(
	user: string,
	listSlug: string,
	itemType: "movies" | "shows",
): Promise<PublishItem[]> {
	return fetchTraktItems(
		`/users/${user}/lists/${listSlug}/items/${itemType}`,
		itemType,
	);
}

/** Official trending feed; does not depend on a user's public mirror list. */
export async function fetchTraktTrendingItems(
	itemType: "movies" | "shows",
): Promise<PublishItem[]> {
	return fetchTraktItems(`/${itemType}/trending`, itemType);
}

async function fetchTraktItems(
	path: string,
	itemType: "movies" | "shows",
): Promise<PublishItem[]> {
	const items: PublishItem[] = [];
	for (let page = 1; page <= MAX_PAGES; page++) {
		const url = `${API_BASE}${path}?page=${page}&limit=${PAGE_LIMIT}`;
		const res = await fetchWithRetry(url, {
			headers: {
				"Content-Type": "application/json",
				"trakt-api-version": "2",
				"trakt-api-key": TRAKT_CLIENT_ID,
			},
		});
		if (!res.ok) {
			throw new Error(
				`Trakt ${path}: HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`,
			);
		}
		const rows = (await res.json()) as TraktListItem[];
		for (const row of rows) {
			const media = itemType === "movies" ? row.movie : row.show;
			if (!media?.title || !media.ids?.tmdb) continue;
			items.push({ title: media.title, tmdbId: media.ids.tmdb });
		}
		if (rows.length < PAGE_LIMIT) break;
	}
	return items;
}

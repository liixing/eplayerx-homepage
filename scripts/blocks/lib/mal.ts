/**
 * Shared MyAnimeList ranking fetcher (myanimelist.net/topanime.php).
 *
 * Parses the ranking table HTML (50 rows per page). Only TV/ONA entries are
 * kept — movies/OVAs don't fit the block's tv media type. MAL romaji titles
 * resolve through TMDB's alternative-title search, restricted to animation.
 */

import type { PublishItem } from "../../../src/blocks/publish.js";

const BASE_URL = "https://myanimelist.net/topanime.php";
const SERIES_TYPES = new Set(["TV", "ONA"]);

const HEADERS = {
	"User-Agent":
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
	Accept: "text/html",
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function decodeEntities(text: string): string {
	return text
		.replace(/&#0?39;|&#x27;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&amp;/g, "&");
}

export interface MalRankingOptions {
	/** topanime.php `type` query, e.g. "bypopularity"; omit for the top rating list. */
	type?: string;
	/** 50 rows per page; TV/ONA filtering trims the rest. */
	pages?: number;
	maxItems?: number;
	/** TMDB ids pinned where romaji search fails (donghua pinyin, odd sequels). */
	knownIds?: Record<string, number>;
}

export async function fetchMalRankingItems(
	options: MalRankingOptions = {},
): Promise<PublishItem[]> {
	const { type, pages = 3, maxItems = 100, knownIds = {} } = options;
	const items: PublishItem[] = [];
	for (let page = 0; page < pages && items.length < maxItems; page++) {
		const params = new URLSearchParams();
		if (type) params.set("type", type);
		params.set("limit", String(page * 50));
		const res = await fetch(`${BASE_URL}?${params}`, { headers: HEADERS });
		if (!res.ok) {
			throw new Error(`MAL page error: ${res.status}`);
		}
		const html = await res.text();

		for (const row of html.split('<tr class="ranking-list">').slice(1)) {
			// The text link has the bare class; the poster link has extra classes.
			const title = row.match(/class="hoverinfo_trigger">([^<]+)</);
			const rowType = row.match(
				/class="information di-ib mt4">\s*([A-Za-z]+)/,
			);
			if (!title || !rowType || !SERIES_TYPES.has(rowType[1])) continue;
			const name = decodeEntities(title[1].trim());
			items.push({ title: name, tmdbId: knownIds[name] });
			if (items.length >= maxItems) break;
		}
		await delay(500);
	}
	return items;
}

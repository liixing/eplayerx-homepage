/**
 * MyAnimeList top anime ranking (myanimelist.net/topanime.php).
 * Submission: MyAnimeList 总榜 (zh-CN, anime, poster-list).
 *
 * Parses the ranking table HTML (50 rows per page). Only TV/ONA entries are
 * kept — movies/OVAs don't fit the block's tv media type. MAL romaji titles
 * resolve through TMDB's alternative-title search, restricted to animation.
 *
 * Run: bun run scripts/blocks/monthly/mal-top-anime.ts
 */

import {
	publishBlock,
	type PublishItem,
} from "../../../src/blocks/publish.js";
import { TMDB_TV_GENRE_ANIMATION } from "../../../src/crawler/tmdb-enrich.js";

const BASE_URL = "https://myanimelist.net/topanime.php";
const PAGES = 3; // 50 rows per page; TV/ONA filtering trims the rest
const MAX_ITEMS = 100;
const SERIES_TYPES = new Set(["TV", "ONA"]);

/**
 * TMDB ids pinned where romaji search fails: donghua entries are listed in
 * pinyin (unsearchable on TMDB) and a few sequels lack the base entry in the
 * ranking. Season entries of shows already ranked are left to dedupe.
 */
const KNOWN_IDS: Record<string, number> = {
	"Kingdom 3rd Season": 46437,
	"Mo Dao Zu Shi: Wanjie Pian": 80732,
	"Tian Guan Cifu Er": 112398,
	"Guimi Zhi Zhu: Xiaochou Pian": 232230,
	"Doupo Cangqiong: San Nian Zhi Yue": 79481,
	"Hibike! Euphonium 3": 62564,
	"Ashita no Joe 2": 25117,
};

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

async function fetchItems(): Promise<PublishItem[]> {
	const items: PublishItem[] = [];
	for (let page = 0; page < PAGES && items.length < MAX_ITEMS; page++) {
		const res = await fetch(`${BASE_URL}?limit=${page * 50}`, {
			headers: HEADERS,
		});
		if (!res.ok) {
			throw new Error(`MAL page error: ${res.status}`);
		}
		const html = await res.text();

		for (const row of html.split('<tr class="ranking-list">').slice(1)) {
			// The text link has the bare class; the poster link has extra classes.
			const title = row.match(/class="hoverinfo_trigger">([^<]+)</);
			const type = row.match(/class="information di-ib mt4">\s*([A-Za-z]+)/);
			if (!title || !type || !SERIES_TYPES.has(type[1])) continue;
			const name = decodeEntities(title[1].trim());
			items.push({ title: name, tmdbId: KNOWN_IDS[name] });
			if (items.length >= MAX_ITEMS) break;
		}
		await delay(500);
	}
	return items;
}

await publishBlock({
	submissionId: "f234d42fa879",
	blockId: "community-mal-top-anime",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	requireTvGenreIds: [TMDB_TV_GENRE_ANIMATION],
	fetchItems,
});

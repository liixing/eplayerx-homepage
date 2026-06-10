/**
 * BFI Sight & Sound "The Greatest Films of All Time" — critics' top 100.
 * Submission: 视与听Top100 (zh-CN, movie, poster-list) by @Zemkk.
 *
 * The results page server-renders every ranked film as a PreviewCard
 * article; we keep rank <= 100 in poll order. Titles are English, so the
 * release year is passed along to disambiguate remakes on TMDB search.
 *
 * Run: bun run scripts/blocks/manual/bfi-sight-sound-100.ts
 */

import {
	publishBlock,
	type PublishItem,
} from "../../../src/blocks/publish.js";

const SOURCE_URL =
	"https://www.bfi.org.uk/sight-and-sound/greatest-films-all-time";
const TOP_RANK = 100;

/**
 * TMDB ids pinned by hand where English-title search fails or mismatches
 * (generic titles like "Mirror"/"Stalker" bury the classics, and TMDB
 * release years can drift from BFI's by 2+ years, e.g. Beau travail).
 */
const KNOWN_IDS: Record<string, number> = {
	"In the Mood for Love": 843,
	Mirror: 1396,
	Stalker: 1398,
	"Yi Yi": 25538,
	Daisies: 46919,
	"The Leopard": 1040,
	"Black Girl": 95597,
	"Beau travail": 14626,
};

const HEADERS = {
	"User-Agent":
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
	Accept: "text/html",
};

function decodeEntities(text: string): string {
	return text
		.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
			String.fromCodePoint(Number.parseInt(hex, 16)),
		)
		.replace(/&#(\d+);/g, (_, dec) =>
			String.fromCodePoint(Number.parseInt(dec, 10)),
		)
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'");
}

async function fetchItems(): Promise<PublishItem[]> {
	const res = await fetch(SOURCE_URL, { headers: HEADERS });
	if (!res.ok) {
		throw new Error(`BFI page error: ${res.status}`);
	}
	const html = await res.text();

	const films: { rank: number; title: string; year?: number }[] = [];
	for (const chunk of html.split("<article ").slice(1)) {
		if (!chunk.includes("PreviewCard__Article")) continue;
		const c = chunk.replace(/<!-- -->/g, "");
		const title = c.match(/<h1>([^<]+)<\/h1>/);
		const rank = c.match(/ResultsPage__Rank[^>]*>=?(\d+)</);
		const year = c.match(/ResultsPage__P[^>]*>(\d{4})[^<]*</);
		if (!title || !rank) continue;
		films.push({
			rank: Number.parseInt(rank[1], 10),
			title: decodeEntities(title[1]).trim(),
			year: year ? Number.parseInt(year[1], 10) : undefined,
		});
	}

	const top = films
		.filter((f) => f.rank <= TOP_RANK)
		.sort((a, b) => a.rank - b.rank);
	if (top.length < TOP_RANK / 2) {
		throw new Error(`Suspiciously few films parsed: ${top.length}`);
	}
	return top.map((f) => ({
		title: f.title,
		year: f.year,
		tmdbId: KNOWN_IDS[f.title],
	}));
}

await publishBlock({
	submissionId: "497928c31377",
	blockId: "community-bfi-sight-sound-100",
	mediaType: "movie",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems,
});

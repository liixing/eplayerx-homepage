/**
 * Rotten Tomatoes editorial "25 Most Popular TV Shows Right Now"
 * (editorial.rottentomatoes.com/guide/popular-tv-shows).
 * Submission: 25 Most Popular TV Shows Right Now (zh-CN, tv, poster-list) by @kk.
 *
 * The guide is a WP countdown page: each entry is a block-countdown div with
 * an id carrying the rank and a meta-title link "Title: Season N".
 *
 * Run: bun run scripts/blocks/weekly/rt-popular-tv.ts
 */

import {
	type PublishItem,
	publishBlock,
} from "../../../src/blocks/publish.js";

const GUIDE_URL = "https://editorial.rottentomatoes.com/guide/popular-tv-shows/";

const HEADERS = {
	"User-Agent":
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
	Accept: "text/html",
};

function decodeEntities(text: string): string {
	return text
		.replace(/&#0?39;|&#x27;|&#8217;/g, "'")
		.replace(/&#8211;/g, "–")
		.replace(/&quot;/g, '"')
		.replace(/&amp;/g, "&");
}

/** "The Boroughs: Season 1" -> "The Boroughs". */
function stripSeasonLabel(title: string): string {
	return title.replace(/:\s*(Season\s*\d+|Limited Series|Miniseries)$/i, "");
}

async function fetchItems(): Promise<PublishItem[]> {
	const res = await fetch(GUIDE_URL, { headers: HEADERS });
	if (!res.ok) {
		throw new Error(`RT guide error: ${res.status}`);
	}
	const html = await res.text();

	const entries: { rank: number; title: string }[] = [];
	const blockPattern =
		/<div id="countdown-index-(\d+)"[\s\S]*?class="meta-title"[^>]*>([^<]+)<\/a>/g;
	for (const match of html.matchAll(blockPattern)) {
		const rank = Number.parseInt(match[1], 10);
		const title = stripSeasonLabel(decodeEntities(match[2]).trim());
		if (title) entries.push({ rank, title });
	}
	if (entries.length < 10) {
		throw new Error(`Suspiciously few RT entries parsed: ${entries.length}`);
	}
	return entries
		.sort((a, b) => a.rank - b.rank)
		.map((entry) => ({ title: entry.title }));
}

await publishBlock({
	submissionId: "4a97a19b361c",
	blockId: "community-rt-popular-tv",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems,
});

/**
 * Rolling Stone "The 100 Greatest TV Shows of All Time" (2022 edition).
 * Submission: 滚石TOP100剧集 (zh-CN, tv, thumb-list) by @宇多田光.
 *
 * The gallery embeds a `pmcGalleryExports = {...}` JSON blob per page
 * (50 items each, ordered 100 -> 1); we follow `nextPageLink` and sort by
 * `positionDisplay`. Titles are wrapped in curly quotes with optional
 * region suffixes like "(U.S.)".
 *
 * Run: bun run scripts/blocks/manual/rolling-stone-100-tv.ts
 */

import {
	publishBlock,
	type PublishItem,
} from "../../../src/blocks/publish.js";

const SOURCE_URL =
	"https://www.rollingstone.com/tv-movies/tv-movie-lists/best-tv-shows-of-all-time-1234598313/";
const EXPECTED_COUNT = 100;

/**
 * TMDB ids pinned where bare-title TV search is ambiguous (TV search has no
 * year filter): UK/US same-name shows, remade classics, talk/variety shows.
 */
const KNOWN_IDS: Record<string, number> = {
	"The Office (U.S.)": 2316,
	"The Office (U.K.)": 2996,
	"The Daily Show With Jon Stewart": 2224,
	"The Tonight Show Starring Johnny Carson": 2261,
	// Bare-title search drifts to Gilmore Girls / the reality spinoff / a
	// later same-name channel; pin the HBO 2012 show, the 2021 K-drama and
	// the 1976 Second City Television.
	Girls: 42282,
	"Squid Game": 93405,
	SCTV: 2548,
};

const HEADERS = {
	"User-Agent":
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
	Accept: "text/html",
};

interface GalleryItem {
	positionDisplay: number;
	title: string;
}

interface GalleryPage {
	gallery: GalleryItem[];
	galleryCount: number;
	nextPageLink: string | null;
}

/** Extract the balanced `pmcGalleryExports = {...}` object from page HTML. */
function extractGalleryJson(html: string): GalleryPage {
	const marker = html.match(/pmcGalleryExports\s*=\s*/);
	if (!marker || marker.index === undefined) {
		throw new Error("pmcGalleryExports not found");
	}
	const start = marker.index + marker[0].length;
	let depth = 0;
	let inString = false;
	for (let i = start; i < html.length; i++) {
		const ch = html[i];
		if (inString) {
			if (ch === "\\") i++;
			else if (ch === '"') inString = false;
			continue;
		}
		if (ch === '"') inString = true;
		else if (ch === "{") depth++;
		else if (ch === "}") {
			depth--;
			if (depth === 0) {
				return JSON.parse(html.slice(start, i + 1)) as GalleryPage;
			}
		}
	}
	throw new Error("Unbalanced pmcGalleryExports JSON");
}

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

/** "‘The Office’ (U.S.)" -> "The Office (U.S.)" -> base + region noise removed. */
function cleanTitle(raw: string): string {
	const unquoted = decodeEntities(raw)
		.trim()
		.replace(/^[\u2018\u201C'"]/, "")
		.replace(/[\u2019\u201D'"](?=\s*(\(|$))/, "")
		.trim();
	return unquoted.replace(/\s*\((U\.?S\.?|U\.?K\.?)\)$/i, "").trim();
}

/** Lookup key keeps the region suffix so U.S./U.K. pins stay distinct. */
function pinKey(raw: string): string {
	return decodeEntities(raw)
		.trim()
		.replace(/^[\u2018\u201C'"]/, "")
		.replace(/[\u2019\u201D'"](?=\s*(\(|$))/, "")
		.trim();
}

async function fetchItems(): Promise<PublishItem[]> {
	const byRank = new Map<number, string>();
	let url: string | null = SOURCE_URL;
	let expected = EXPECTED_COUNT;
	while (url && byRank.size < expected) {
		const res = await fetch(url, { headers: HEADERS });
		if (!res.ok) {
			throw new Error(`Rolling Stone page error: ${res.status} (${url})`);
		}
		const page = extractGalleryJson(await res.text());
		expected = page.galleryCount;
		for (const item of page.gallery) {
			byRank.set(item.positionDisplay, item.title);
		}
		url = page.nextPageLink;
	}

	if (byRank.size !== EXPECTED_COUNT) {
		throw new Error(`Expected ${EXPECTED_COUNT} entries, got ${byRank.size}`);
	}
	return Array.from(byRank.entries())
		.sort((a, b) => a[0] - b[0])
		.map(([, rawTitle]) => ({
			title: cleanTitle(rawTitle),
			tmdbId: KNOWN_IDS[pinKey(rawTitle)],
		}));
}

await publishBlock({
	submissionId: "a4ac1a713a31",
	blockId: "community-rolling-stone-100-tv",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems,
});

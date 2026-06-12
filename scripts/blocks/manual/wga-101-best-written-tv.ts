/**
 * WGA "101 Best Written TV Series" (announced June 2, 2013; static list).
 * Submission: WGA Top101 剧集 (zh-CN, tv, thumb-list) by @宇多田光.
 *
 * The page server-renders each entry as "N." / TITLE / "Aired: NETWORK,
 * YYYY-..."; we strip tags and walk the text lines. Each entry appears
 * twice (preview + full card), deduped by rank+title. Ties share a rank.
 *
 * Run: bun run scripts/blocks/manual/wga-101-best-written-tv.ts
 */

import {
	publishBlock,
	type PublishItem,
} from "../../../src/blocks/publish.js";

const SOURCE_URL =
	"https://www.wga.org/writers-room/101-best-lists/101-best-written-tv-series/list";
const EXPECTED_COUNT = 101;

/**
 * TMDB ids pinned where bare-title TV search is ambiguous (TV search has no
 * year filter): UK/US same-name shows, remade classics, talk/variety shows.
 */
const KNOWN_IDS: Record<string, number> = {
	"THE OFFICE (UK)": 2996,
	"THE OFFICE (U.S.)": 2316,
	"THE DAILY SHOW WITH JON STEWART": 2224,
	"SGT. BILKO (THE PHIL SILVERS SHOW)": 11747,
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
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'");
}

/** "BATTLESTAR GALACTICA (2005) - TIE" -> base title + alt queries. */
function cleanTitle(raw: string): { title: string; altTitles?: string[] } {
	let title = raw.replace(/\s*-\s*TIE$/i, "").trim();
	const paren = title.match(/^(.*?)\s*\(([^)]+)\)$/);
	if (!paren) return { title };
	const base = paren[1].trim();
	const inner = paren[2].trim();
	// Year / region qualifiers are search noise; named alternates are queries.
	if (/^\d{4}$/.test(inner) || /^U\.?[SK]\.?$/i.test(inner)) {
		return { title: base };
	}
	return { title: base, altTitles: [inner] };
}

async function fetchItems(): Promise<PublishItem[]> {
	const res = await fetch(SOURCE_URL, { headers: HEADERS });
	if (!res.ok) {
		throw new Error(`WGA page error: ${res.status}`);
	}
	const html = await res.text();
	const text = decodeEntities(
		html
			.replace(/<script[\s\S]*?<\/script>/g, "")
			.replace(/<style[\s\S]*?<\/style>/g, "")
			.replace(/<[^>]+>/g, "\n"),
	);
	const lines = text
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);

	const seen = new Set<string>();
	const items: PublishItem[] = [];
	for (let i = 0; i < lines.length; i++) {
		if (!lines[i].startsWith("Aired:")) continue;
		// Walk back to the "N." rank line; the title sits right after it.
		for (let j = i - 1; j >= Math.max(i - 6, 0); j--) {
			if (!/^\d+\.$/.test(lines[j])) continue;
			const rawTitle = lines[j + 1];
			const key = `${lines[j]}${rawTitle}`;
			if (!seen.has(key)) {
				seen.add(key);
				items.push({
					...cleanTitle(rawTitle),
					tmdbId: KNOWN_IDS[rawTitle.replace(/\s*-\s*TIE$/i, "").trim()],
				});
			}
			break;
		}
	}

	if (items.length !== EXPECTED_COUNT) {
		throw new Error(`Expected ${EXPECTED_COUNT} entries, got ${items.length}`);
	}
	return items;
}

await publishBlock({
	submissionId: "190f7970c51e",
	blockId: "community-wga-101-best-written-tv",
	mediaType: "tv",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems,
});

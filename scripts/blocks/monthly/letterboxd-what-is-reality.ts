/**
 * Letterboxd list "What is reality?" by @tediously_brief
 * (letterboxd.com/tediously_brief/list/what-is-reality).
 * Submission: 惊悚片 (zh-CN, movie, thumb-list).
 *
 * The full list runs ~1,600 films; only the first 3 pages (300 items, list
 * order) are kept so the monthly TMDB enrichment stays within CI budget.
 * Titles are English with a year, e.g. data-item-name="Donnie Darko (2001)".
 *
 * Run: bun run scripts/blocks/monthly/letterboxd-what-is-reality.ts
 */

import {
	publishBlock,
	type PublishItem,
} from "../../../src/blocks/publish.js";

const LIST_BASE =
	"https://letterboxd.com/tediously_brief/list/what-is-reality/";
const MAX_PAGES = 3;
const PAGE_DELAY_MS = 500;

const HEADERS = {
	"User-Agent":
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
	Accept: "text/html",
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

/** Poster grid entries carry data-item-name="Title (Year)" in list order. */
function parsePage(html: string): PublishItem[] {
	const items: PublishItem[] = [];
	for (const match of html.matchAll(/data-item-name="([^"]+)"/g)) {
		const display = decodeEntities(match[1]).trim();
		const parts = display.match(/^(.*?)\s*\((\d{4})\)$/);
		items.push(
			parts
				? { title: parts[1], year: Number.parseInt(parts[2], 10) }
				: { title: display },
		);
	}
	return items;
}

async function fetchItems(): Promise<PublishItem[]> {
	const items: PublishItem[] = [];
	for (let page = 1; page <= MAX_PAGES; page++) {
		const url = page === 1 ? LIST_BASE : `${LIST_BASE}page/${page}/`;
		const res = await fetch(url, { headers: HEADERS });
		if (!res.ok) {
			throw new Error(`Letterboxd page ${page} error: ${res.status}`);
		}
		const pageItems = parsePage(await res.text());
		items.push(...pageItems);
		if (pageItems.length === 0) break;
		await delay(PAGE_DELAY_MS);
	}
	if (items.length < 50) {
		throw new Error(`Suspiciously few films parsed: ${items.length}`);
	}
	return items;
}

await publishBlock({
	submissionId: "3a02607a5f96",
	blockId: "community-letterboxd-what-is-reality",
	mediaType: "movie",
	language: "zh-CN",
	useTmdbTitle: true,
	fetchItems,
});

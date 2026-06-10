/**
 * Shared Letterboxd list fetcher. Poster grid entries carry
 * data-item-name="Title (Year)" in list order, 100 per page.
 */

import type { PublishItem } from "../../../src/blocks/publish.js";

const HEADERS = {
	"User-Agent":
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
	Accept: "text/html",
};

const PAGE_DELAY_MS = 500;

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

/**
 * Entries of a Letterboxd list, in list order.
 * @param listUrl e.g. "https://letterboxd.com/official/list/top-100-japanese-films/"
 */
export async function fetchLetterboxdListItems(
	listUrl: string,
	maxPages = 3,
	minItems = 50,
): Promise<PublishItem[]> {
	const base = listUrl.endsWith("/") ? listUrl : `${listUrl}/`;
	const items: PublishItem[] = [];
	for (let page = 1; page <= maxPages; page++) {
		const url = page === 1 ? base : `${base}page/${page}/`;
		const res = await fetch(url, { headers: HEADERS });
		if (!res.ok) {
			throw new Error(`Letterboxd page ${page} error: ${res.status}`);
		}
		const pageItems = parsePage(await res.text());
		items.push(...pageItems);
		if (pageItems.length === 0) break;
		await delay(PAGE_DELAY_MS);
	}
	if (items.length < minItems) {
		throw new Error(`Suspiciously few films parsed: ${items.length}`);
	}
	return items;
}

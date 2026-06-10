/**
 * Shared parser for ForwardWidget static-list scripts
 * (e.g. ftufkc/ArtFilmForwardWidgets tspdt-static.js / cc-static.js).
 *
 * Each script embeds `const <NAME> = [ ...json entries... ]` where entries
 * already carry TMDB ids, so publishing skips title search entirely.
 */

import type { PublishItem } from "../../../src/blocks/publish.js";

interface ForwardStaticEntry {
	id: number;
	type: string;
	title: string;
	mediaType: string;
}

export async function fetchForwardStaticItems(
	url: string,
	arrayName: string,
): Promise<PublishItem[]> {
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Forward static source error: ${res.status}`);
	}
	const text = await res.text();

	const marker = `const ${arrayName} = `;
	const start = text.indexOf(marker);
	if (start === -1) {
		throw new Error(`${arrayName} array not found in source`);
	}
	const arrayStart = text.indexOf("[", start);
	const arrayEnd = text.indexOf("\n]", arrayStart);
	if (arrayStart === -1 || arrayEnd === -1) {
		throw new Error(`Failed to locate ${arrayName} array bounds`);
	}
	const entries = JSON.parse(
		text.slice(arrayStart, arrayEnd + 2),
	) as ForwardStaticEntry[];

	return entries
		.filter((e) => e.type === "tmdb" && e.mediaType === "movie" && e.id > 0)
		.map((e) => ({ title: e.title, tmdbId: e.id }));
}

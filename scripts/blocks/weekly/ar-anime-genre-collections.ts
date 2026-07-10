/**
 * Anime genre collection — TMDB discover by keyword (Fusion widget export).
 * Submission: Anime (71a66aaa7cc7, ar-SA).
 * Source: https://raw.githubusercontent.com/Tsarinkov/Anime-Genre/refs/heads/main/Anime-genre-collections.json
 *
 * Publishes hidden child snapshots, then run:
 *   bun run scripts/blocks/manual/register-ar-anime-genre-collections.ts
 *
 * Run: bun run scripts/blocks/weekly/ar-anime-genre-collections.ts
 */

import { publishBlock } from "../../../src/blocks/publish.js";
import {
	ANIME_GENRE_BLOCK_PREFIX,
	ANIME_GENRE_SOURCE_URL,
	animeGenreBlockId,
	fetchAnimeGenreEntries,
	fetchAnimeGenreItems,
} from "../lib/anime-genre.js";
import { fetchSubmitterToken } from "../lib/tmdb-discover.js";

export const SUBMISSION_ID = "71a66aaa7cc7";
export const LANGUAGE = "ar-SA";
export const SOURCE_URL = ANIME_GENRE_SOURCE_URL;
export const BLOCK_ID_PREFIX = ANIME_GENRE_BLOCK_PREFIX;

const token = await fetchSubmitterToken(SUBMISSION_ID);
const entries = await fetchAnimeGenreEntries(SOURCE_URL);

export const children = entries.map((entry) => ({
	blockId: animeGenreBlockId(entry.title),
	label: entry.title.trim(),
	...(entry.imageURL ? { image: entry.imageURL } : {}),
}));

let failed = false;
for (const entry of entries) {
	const blockId = animeGenreBlockId(entry.title);
	try {
		await publishBlock({
			submissionId: SUBMISSION_ID,
			blockId,
			mediaType: "tv",
			language: LANGUAGE,
			useTmdbTitle: true,
			fetchItems: () => fetchAnimeGenreItems(token, entry, LANGUAGE),
		});
	} catch (error) {
		failed = true;
		console.error(`✗ ${blockId} failed:`, error);
	}
}
if (failed) process.exit(1);

console.log("\nCollection children spec:");
for (const child of children) {
	console.log(
		`${child.blockId} | ${child.label}${child.image ? ` | ${child.image}` : ""}`,
	);
}

/**
 * Register hidden blocks + create collection for ar-anime-genre-collections.
 *
 * Run AFTER child snapshots exist:
 *   bun run scripts/blocks/weekly/ar-anime-genre-collections.ts
 * Then:
 *   bun run scripts/blocks/manual/register-ar-anime-genre-collections.ts
 */

import {
	ANIME_GENRE_BLOCK_PREFIX,
	ANIME_GENRE_SOURCE_URL,
	animeGenreBlockId,
	fetchAnimeGenreEntries,
} from "../lib/anime-genre.js";
import {
	createCollection,
	registerHiddenChildren,
	warmCollectionPreviewR2,
} from "../lib/register-collection.js";

const SUBMISSION_ID = "71a66aaa7cc7";
const LANGUAGE = "ar-SA";
const COLLECTION_TITLE = "Anime";

const entries = await fetchAnimeGenreEntries(ANIME_GENRE_SOURCE_URL);
const childEntries = entries.map((entry) => ({
	blockId: animeGenreBlockId(entry.title),
	title: entry.title.trim(),
	...(entry.imageURL ? { image: entry.imageURL } : {}),
}));

const { ready, registered, existing } = await registerHiddenChildren(
	childEntries,
	{
		category: "anime",
		mediaType: "tv",
		language: LANGUAGE,
		isAnime: true,
		strict: true,
	},
);
console.log(
	`✓ hidden blocks: ${registered} new, ${existing} existing, ${ready.length} ready (prefix ${ANIME_GENRE_BLOCK_PREFIX})`,
);

const { blockId, itemCount } = await createCollection({
	title: COLLECTION_TITLE,
	category: "anime",
	mode: "custom",
	style: "image-portrait",
	language: LANGUAGE,
	children: ready,
});
console.log(`✓ collection ${blockId} (${itemCount} items)`);

await warmCollectionPreviewR2(blockId);

const reviewedAt = new Date().toISOString();
const proc = Bun.spawnSync(
	[
		"bunx",
		"wrangler",
		"d1",
		"execute",
		"blocks",
		"--remote",
		"--command",
		`UPDATE submissions SET status='approved', block_id='${blockId}', item_count=${itemCount}, reviewed_at='${reviewedAt}' WHERE id='${SUBMISSION_ID}'`,
	],
	{ cwd: process.cwd(), stdout: "inherit", stderr: "inherit" },
);
if (proc.exitCode !== 0) process.exit(1);
console.log(`✓ submission ${SUBMISSION_ID} approved`);

/**
 * Surgically replace one mismatched item in a published block snapshot,
 * without re-scraping or re-resolving the other entries.
 *
 * Downloads the snapshot from R2, swaps the item whose tmdbId equals
 * <oldTmdbId> with freshly fetched TMDB details for <newTmdbId> (same
 * position, TMDB localized title), and re-uploads.
 *
 * Run: bun run scripts/blocks/manual/patch-item.ts <blockId> <oldTmdbId> <newTmdbId> [movie|tv] [language]
 * e.g. bun run scripts/blocks/manual/patch-item.ts community-bfi-sight-sound-100 654086 843
 */

import { fetchImageMeta } from "../../../src/crawler/tmdb-enrich.js";
import { getSnapshot, publicKey, putSnapshot } from "../../../src/blocks/storage.js";
import type { MediaType, SnapshotItem } from "../../../src/blocks/types.js";
import { tmdb } from "../../../src/tmdb/client.js";

const [blockId, oldIdArg, newIdArg, typeArg, langArg] = process.argv.slice(2);
if (!blockId || !oldIdArg || !newIdArg) {
	console.error(
		"Usage: bun run scripts/blocks/manual/patch-item.ts <blockId> <oldTmdbId> <newTmdbId> [movie|tv] [language]",
	);
	process.exit(1);
}
const oldTmdbId = Number.parseInt(oldIdArg, 10);
const newTmdbId = Number.parseInt(newIdArg, 10);
const mediaType: MediaType = typeArg === "tv" ? "tv" : "movie";
const language = langArg || "zh-CN";

async function buildItem(): Promise<SnapshotItem> {
	const query = { language };
	const result =
		mediaType === "movie"
			? await tmdb.GET(`/3/movie/${newTmdbId}`, {
					params: { path: { movie_id: newTmdbId }, query },
				})
			: await tmdb.GET(`/3/tv/${newTmdbId}`, {
					params: { path: { series_id: newTmdbId }, query },
				});
	const data = result.data as
		| (SnapshotItem & {
				id?: number;
				name?: string;
				genres?: { id: number }[];
		  })
		| undefined;
	if (!data?.id) {
		throw new Error(`TMDB details not found for ${mediaType}/${newTmdbId}`);
	}

	const { thumb, logo, noLogoPoster } = await fetchImageMeta(
		data.id,
		mediaType,
		data.backdrop_path,
		data.poster_path,
	);

	return {
		title: data.name || data.title || String(newTmdbId),
		tmdbId: data.id,
		vote_average: data.vote_average ?? null,
		poster_path: data.poster_path ?? null,
		backdrop_path: data.backdrop_path ?? null,
		genre_ids: data.genres?.map((g) => g.id) ?? [],
		media_type: mediaType,
		release_date: data.release_date ?? null,
		first_air_date: data.first_air_date ?? null,
		overview: data.overview ?? null,
		thumb,
		logo,
		noLogoPoster,
	};
}

const key = publicKey(blockId);
const items = await getSnapshot(key);
const index = items.findIndex((item) => item.tmdbId === oldTmdbId);
if (index === -1) {
	throw new Error(`tmdbId ${oldTmdbId} not found in ${blockId}`);
}

const replacement = await buildItem();
console.log(
	`🔁 #${index + 1} ${items[index].title} (${oldTmdbId}) -> ${replacement.title} (${replacement.tmdbId})`,
);
items[index] = replacement;
await putSnapshot(key, items);
console.log(`💾 ${blockId} updated (${items.length} items)`);

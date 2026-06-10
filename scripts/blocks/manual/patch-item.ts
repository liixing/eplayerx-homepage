/**
 * Surgically replace mismatched items in a published block snapshot,
 * without re-scraping or re-resolving the other entries.
 *
 * Downloads the snapshot from R2 once, swaps every item whose tmdbId equals
 * <oldTmdbId> with freshly fetched TMDB details for <newTmdbId> (same
 * position, TMDB localized title), and re-uploads once.
 *
 * Run: bun run scripts/blocks/manual/patch-item.ts <blockId> <oldTmdbId:newTmdbId>... [movie|tv] [language]
 * e.g. bun run scripts/blocks/manual/patch-item.ts community-bfi-sight-sound-100 654086:843 4960:11490
 * (legacy two-arg form "<oldTmdbId> <newTmdbId>" still works)
 */

import { fetchImageMeta } from "../../../src/crawler/tmdb-enrich.js";
import {
	getSnapshot,
	publicKey,
	putSnapshot,
} from "../../../src/blocks/storage.js";
import type { MediaType, SnapshotItem } from "../../../src/blocks/types.js";
import { tmdb } from "../../../src/tmdb/client.js";

const TMDB_REQUEST_DELAY_MS = 300;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const USAGE =
	"Usage: bun run scripts/blocks/manual/patch-item.ts <blockId> <oldTmdbId:newTmdbId>... [movie|tv] [language]";

const [blockId, ...rest] = process.argv.slice(2);
let mediaType: MediaType = "movie";
let language = "zh-CN";
const pairs: [number, number][] = [];
const bareIds: number[] = [];

for (const arg of rest) {
	if (arg === "movie" || arg === "tv") {
		mediaType = arg;
	} else if (/^\d+:\d+$/.test(arg)) {
		const [oldId, newId] = arg.split(":");
		pairs.push([Number.parseInt(oldId, 10), Number.parseInt(newId, 10)]);
	} else if (/^\d+$/.test(arg)) {
		bareIds.push(Number.parseInt(arg, 10));
	} else {
		language = arg;
	}
}
// Legacy form: two bare ids mean a single old -> new replacement.
if (pairs.length === 0 && bareIds.length === 2) {
	pairs.push([bareIds[0], bareIds[1]]);
}

if (!blockId || pairs.length === 0) {
	console.error(USAGE);
	process.exit(1);
}

async function buildItem(newTmdbId: number): Promise<SnapshotItem> {
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

// Validate all targets exist before any TMDB fetch, so the run is all-or-nothing.
for (const [oldTmdbId] of pairs) {
	if (!items.some((item) => item.tmdbId === oldTmdbId)) {
		throw new Error(`tmdbId ${oldTmdbId} not found in ${blockId}`);
	}
}

for (const [oldTmdbId, newTmdbId] of pairs) {
	const index = items.findIndex((item) => item.tmdbId === oldTmdbId);
	const replacement = await buildItem(newTmdbId);
	console.log(
		`🔁 #${index + 1} ${items[index].title} (${oldTmdbId}) -> ${replacement.title} (${replacement.tmdbId})`,
	);
	items[index] = replacement;
	await delay(TMDB_REQUEST_DELAY_MS);
}

await putSnapshot(key, items);
console.log(`💾 ${blockId} updated (${items.length} items)`);

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

import { fetchDetailsWithEnrichment } from "../../../src/crawler/tmdb-enrich.js";
import {
	getSnapshot,
	publicKey,
	putSnapshot,
} from "../../../src/blocks/storage.js";
import type { MediaType, SnapshotItem } from "../../../src/blocks/types.js";

const TMDB_REQUEST_DELAY_MS = 300;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const USAGE =
	"Usage: bun run scripts/blocks/manual/patch-item.ts <blockId> <oldTmdbId:newTmdbId|+tmdbId[@rank]>... [movie|tv] [language]";

const [blockId, ...rest] = process.argv.slice(2);
let mediaType: MediaType = "movie";
let language = "zh-CN";
const pairs: [number, number][] = [];
const additions: { tmdbId: number; rank?: number }[] = [];
const bareIds: number[] = [];

for (const arg of rest) {
	if (arg === "movie" || arg === "tv") {
		mediaType = arg;
	} else if (/^\+\d+(?:@\d+)?$/.test(arg)) {
		const [tmdbId, rank] = arg.slice(1).split("@");
		additions.push({
			tmdbId: Number.parseInt(tmdbId, 10),
			...(rank ? { rank: Number.parseInt(rank, 10) } : {}),
		});
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

if (!blockId || (pairs.length === 0 && additions.length === 0)) {
	console.error(USAGE);
	process.exit(1);
}

async function buildItem(newTmdbId: number): Promise<SnapshotItem> {
	const enriched = await fetchDetailsWithEnrichment(
		newTmdbId,
		mediaType,
		language,
	);
	if (!enriched?.tmdbData.id) {
		throw new Error(`TMDB details not found for ${mediaType}/${newTmdbId}`);
	}

	const { tmdbData, externalIds, imageMeta } = enriched;

	return {
		title: tmdbData.name || tmdbData.title || String(newTmdbId),
		tmdbId: newTmdbId,
		imdbId: externalIds.imdbId,
		tvdbId: externalIds.tvdbId,
		vote_average: tmdbData.vote_average ?? null,
		poster_path: tmdbData.poster_path ?? null,
		backdrop_path: tmdbData.backdrop_path ?? null,
		genre_ids: tmdbData.genre_ids ?? [],
		media_type: mediaType,
		release_date: tmdbData.release_date ?? null,
		first_air_date: tmdbData.first_air_date ?? null,
		overview: tmdbData.overview ?? null,
		thumb: imageMeta.thumb,
		logo: imageMeta.logo,
		noLogoPoster: imageMeta.noLogoPoster,
	};
}

const key = publicKey(blockId);
const blob = await getSnapshot(key);
const items = blob.data ?? [];

// Validate all targets exist before any TMDB fetch, so the run is all-or-nothing.
for (const [oldTmdbId] of pairs) {
	if (!items.some((item) => item.tmdbId === oldTmdbId)) {
		throw new Error(`tmdbId ${oldTmdbId} not found in ${blockId}`);
	}
}
for (const addition of additions) {
	if (items.some((item) => item.tmdbId === addition.tmdbId)) {
		throw new Error(`tmdbId ${addition.tmdbId} already exists in ${blockId}`);
	}
	if (
		addition.rank !== undefined &&
		(addition.rank < 1 || addition.rank > items.length + 1)
	) {
		throw new Error(`rank ${addition.rank} is out of range for ${blockId}`);
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

for (const addition of additions) {
	const replacement = await buildItem(addition.tmdbId);
	const index = addition.rank === undefined ? items.length : addition.rank - 1;
	console.log(`➕ #${index + 1} ${replacement.title} (${replacement.tmdbId})`);
	items.splice(index, 0, replacement);
	await delay(TMDB_REQUEST_DELAY_MS);
}

// Preserve the display title the snapshot already carries.
await putSnapshot(key, items, blob.title);
console.log(`💾 ${blockId} updated (${items.length} items)`);

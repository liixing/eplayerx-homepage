/**
 * One-time backfill: add imdbId/tvdbId to every static R2 blob.
 *
 * Covers official crawler JSON (served by /crawler/popular/*) and community
 * block snapshots (served by /blocks/data/*). Uses TMDB /external_ids with
 * a global tmdbId cache so each unique id is queried at most once.
 *
 * Run:
 *   bun run scripts/blocks/manual/backfill-external-ids.ts
 *   bun run scripts/blocks/manual/backfill-external-ids.ts --dry-run
 */

import {
	type ExternalIds,
	fetchExternalIds,
} from "../../../src/crawler/tmdb-enrich.js";
import {
	getRawJson,
	isCollectionPreviewBlob,
	listR2Keys,
	putCollectionPreviewBlob,
	putRawJson,
	putSnapshot,
} from "../../../src/blocks/storage.js";
import type {
	CollectionPreviewBlob,
	MediaType,
	SnapshotBlob,
	SnapshotItem,
} from "../../../src/blocks/types.js";

const TMDB_REQUEST_DELAY_MS = 300;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const OFFICIAL_CRAWLER_KEYS = [
	"douban-movies.json",
	"douban-tv.json",
	"douban-korean-tv.json",
	"douban-japanese-tv.json",
	"hami-taiwanese-tv.json",
	"douban-animation.json",
	"douban-hot-variety-shows.json",
	"bangumi-animation.json",
] as const;

type BackfillItem = SnapshotItem & {
	id?: number;
};

const dryRun = process.argv.includes("--dry-run");

function defaultMediaTypeForKey(key: string): MediaType {
	return key.includes("movie") ? "movie" : "tv";
}

function blockIdFromPublicKey(key: string): string {
	return key.replace(/^blocks\/public\//, "").replace(/\.json$/, "");
}

function itemComplete(item: BackfillItem, mediaType: MediaType): boolean {
	if (!item.imdbId) return false;
	return mediaType === "movie" || item.tvdbId != null;
}

function resolveMediaType(
	item: BackfillItem,
	fallback: MediaType,
): MediaType {
	if (item.media_type === "movie" || item.media_type === "tv") {
		return item.media_type;
	}
	return fallback;
}

async function resolveExternalIds(
	cache: Map<string, ExternalIds>,
	tmdbId: number,
	mediaType: MediaType,
): Promise<ExternalIds> {
	const cacheKey = `${mediaType}:${tmdbId}`;
	const hit = cache.get(cacheKey);
	if (hit) return hit;

	const ids = await fetchExternalIds(tmdbId, mediaType);
	cache.set(cacheKey, ids);
	await delay(TMDB_REQUEST_DELAY_MS);
	return ids;
}

async function backfillItems(
	items: BackfillItem[],
	defaultMediaType: MediaType,
	cache: Map<string, ExternalIds>,
): Promise<number> {
	let touched = 0;
	for (const item of items) {
		const tmdbId = item.tmdbId ?? item.id;
		if (!tmdbId) continue;

		const mediaType = resolveMediaType(item, defaultMediaType);
		if (itemComplete(item, mediaType)) continue;

		const ids = await resolveExternalIds(cache, tmdbId, mediaType);
		let changed = false;
		if (item.imdbId !== ids.imdbId) {
			item.imdbId = ids.imdbId;
			changed = true;
		}
		if (mediaType === "tv" && item.tvdbId !== ids.tvdbId) {
			item.tvdbId = ids.tvdbId;
			changed = true;
		}
		if (changed) touched += 1;
	}
	return touched;
}

async function persistBlob(
	key: string,
	raw: unknown,
	dryRun: boolean,
): Promise<void> {
	if (dryRun) return;

	if (isCollectionPreviewBlob(raw)) {
		const blob = raw as CollectionPreviewBlob;
		await putCollectionPreviewBlob(
			blockIdFromPublicKey(key),
			blob.children,
			blob.title,
		);
		return;
	}

	const blob = raw as SnapshotBlob & { lastUpdated?: string };
	if (blob.type === "community_block" && Array.isArray(blob.data)) {
		await putSnapshot(key, blob.data, blob.title);
		return;
	}

	if (typeof blob === "object" && blob !== null) {
		(blob as { lastUpdated?: string }).lastUpdated = new Date().toISOString();
	}
	await putRawJson(key, raw);
}

async function processKey(
	key: string,
	cache: Map<string, ExternalIds>,
): Promise<{ touched: number; changed: boolean }> {
	const raw = await getRawJson(key);
	const defaultMediaType = defaultMediaTypeForKey(key);
	let touched = 0;

	if (isCollectionPreviewBlob(raw)) {
		const blob = raw as CollectionPreviewBlob;
		for (const child of Object.values(blob.children)) {
			touched += await backfillItems(
				child.data as BackfillItem[],
				defaultMediaType,
				cache,
			);
		}
	} else {
		const blob = raw as { data?: BackfillItem[] };
		if (!Array.isArray(blob.data)) {
			return { touched: 0, changed: false };
		}
		touched = await backfillItems(blob.data, defaultMediaType, cache);
	}

	if (touched > 0) {
		await persistBlob(key, raw, dryRun);
	}
	return { touched, changed: touched > 0 };
}

const cache = new Map<string, ExternalIds>();
const blockKeys = await listR2Keys("blocks/public/");
const keys = [...OFFICIAL_CRAWLER_KEYS, ...blockKeys];

console.log(
	`📋 ${keys.length} blob(s) to scan${dryRun ? " (dry run)" : ""}`,
);

let updated = 0;
let unchanged = 0;
let failed = 0;
let itemsTouched = 0;
let apiCalls = 0;

for (const key of keys) {
	try {
		const before = cache.size;
		const result = await processKey(key, cache);
		apiCalls += cache.size - before;
		itemsTouched += result.touched;
		if (result.changed) {
			updated += 1;
			console.log(`💾 ${key}: ${result.touched} item(s)`);
		} else {
			unchanged += 1;
		}
	} catch (error) {
		failed += 1;
		console.error(`✗ ${key}: ${(error as Error).message}`);
	}
}

console.log(
	`✅ done: ${updated} updated, ${unchanged} unchanged, ${failed} failed, ${itemsTouched} items touched, ${apiCalls} TMDB lookups`,
);

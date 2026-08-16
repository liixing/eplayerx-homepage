/**
 * Backfill MDBList ratings onto official crawler JSON and community block
 * snapshots. Unique tmdbIds are cached in R2 (`mdblist-ratings-cache.json`)
 * so each title is queried at most once. Each MDBList key gets 1000/day;
 * this script uses 900 per key and leaves the rest for GET /ratings.
 * Put any number of keys in `MDBLIST_API_KEY`, comma-separated.
 *
 * Resume: re-run locally. Already-cached ids are skipped; remaining titles
 * are filled until the daily budget is spent.
 *
 * Run:
 *   bun run scripts/blocks/manual/backfill-ratings.ts
 *   bun run scripts/blocks/manual/backfill-ratings.ts --dry-run
 *   bun run scripts/blocks/manual/backfill-ratings.ts --limit=900
 */

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
import {
	loadRatingsCache,
	type RatingsCache,
	saveRatingsCache,
} from "../../../src/ratings/cache.js";
import {
	defaultBackfillLimit,
	fetchItemRatings,
	MdblistRateLimitError,
	mdblistKeyCount,
} from "../../../src/ratings/mdblist.js";
import {
	type ItemRatings,
	ratingsCacheKey,
} from "../../../src/ratings/types.js";

const REQUEST_DELAY_MS = 250;
const CACHE_SAVE_EVERY = 50;
const SCAN_CONCURRENCY = 8;
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
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const dailyLimit = Number.parseInt(
	limitArg?.slice("--limit=".length) ||
		process.env.MDBLIST_DAILY_LIMIT ||
		String(defaultBackfillLimit()),
	10,
);

function defaultMediaTypeForKey(key: string): MediaType {
	return key.includes("movie") ? "movie" : "tv";
}

function blockIdFromPublicKey(key: string): string {
	return key.replace(/^blocks\/public\//, "").replace(/\.json$/, "");
}

function resolveMediaType(item: BackfillItem, fallback: MediaType): MediaType {
	if (item.media_type === "movie" || item.media_type === "tv") {
		return item.media_type;
	}
	return fallback;
}

function collectItems(raw: unknown): BackfillItem[] {
	if (isCollectionPreviewBlob(raw)) {
		const items: BackfillItem[] = [];
		for (const child of Object.values(raw.children)) {
			if (Array.isArray(child.data)) {
				items.push(...(child.data as BackfillItem[]));
			}
		}
		return items;
	}
	const blob = raw as { data?: BackfillItem[] };
	return Array.isArray(blob.data) ? blob.data : [];
}

function ratingsEqual(a: ItemRatings | undefined, b: ItemRatings): boolean {
	return JSON.stringify(a ?? null) === JSON.stringify(b);
}

function applyRatings(
	items: BackfillItem[],
	defaultMediaType: MediaType,
	cache: RatingsCache,
): number {
	let touched = 0;
	for (const item of items) {
		const tmdbId = item.tmdbId ?? item.id;
		if (!tmdbId) continue;
		const mediaType = resolveMediaType(item, defaultMediaType);
		const cached = cache.get(ratingsCacheKey(mediaType, tmdbId));
		if (!cached) continue;
		if (ratingsEqual(item.ratings, cached)) continue;
		item.ratings = cached;
		touched += 1;
	}
	return touched;
}

async function persistBlob(key: string, raw: unknown): Promise<void> {
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

async function mapPool<T>(
	items: T[],
	concurrency: number,
	fn: (item: T) => Promise<void>,
): Promise<void> {
	let next = 0;
	const workers = Array.from(
		{ length: Math.min(concurrency, items.length) },
		async () => {
			while (next < items.length) {
				const index = next;
				next += 1;
				await fn(items[index]);
			}
		},
	);
	await Promise.all(workers);
}

if (mdblistKeyCount() === 0 && !dryRun) {
	throw new Error("MDBLIST_API_KEY is not set");
}

const cache = await loadRatingsCache();
const blockKeys = await listR2Keys("blocks/public/");
const keys = [...OFFICIAL_CRAWLER_KEYS, ...blockKeys];

console.log(
	`📋 ${keys.length} blob(s), ${cache.size} cached id(s), ${mdblistKeyCount()} key(s), budget ${dailyLimit}/day${dryRun ? " (dry run)" : ""}`,
);

const missing = new Map<string, { tmdbId: number; mediaType: MediaType }>();
const blobs = new Map<string, unknown>();
let scanned = 0;

await mapPool(keys, SCAN_CONCURRENCY, async (key) => {
	try {
		const raw = await getRawJson(key);
		blobs.set(key, raw);
		const defaultMediaType = defaultMediaTypeForKey(key);
		for (const item of collectItems(raw)) {
			const tmdbId = item.tmdbId ?? item.id;
			if (!tmdbId) continue;
			const mediaType = resolveMediaType(item, defaultMediaType);
			const cacheKey = ratingsCacheKey(mediaType, tmdbId);
			if (!cache.has(cacheKey)) {
				missing.set(cacheKey, { tmdbId, mediaType });
			}
		}
	} catch (error) {
		console.error(`✗ scan ${key}: ${(error as Error).message}`);
	}
	scanned += 1;
	if (scanned % 100 === 0) {
		console.log(`📂 scanned ${scanned}/${keys.length}`);
	}
});

console.log(`🔍 ${missing.size} unique title(s) still need MDBList`);

let fetched = 0;
let failed = 0;
let hitLimit = false;

if (!dryRun && missing.size > 0) {
	for (const [cacheKey, { tmdbId, mediaType }] of missing) {
		if (fetched >= dailyLimit) {
			hitLimit = true;
			break;
		}
		try {
			const ratings = await fetchItemRatings(tmdbId, mediaType);
			cache.set(cacheKey, ratings);
			fetched += 1;
			if (fetched % 25 === 0) {
				console.log(`⬇️  ${fetched}/${Math.min(dailyLimit, missing.size)}`);
			}
			if (fetched % CACHE_SAVE_EVERY === 0) {
				await saveRatingsCache(cache);
			}
		} catch (error) {
			if (error instanceof MdblistRateLimitError) {
				hitLimit = true;
				console.warn("⛔ MDBList 429 — stopping for today");
				break;
			}
			const status = (error as { status?: number }).status;
			if (status === 404) {
				cache.set(cacheKey, {});
				fetched += 1;
			} else {
				failed += 1;
				console.error(`✗ ${mediaType}/${tmdbId}: ${(error as Error).message}`);
			}
		}
		await delay(REQUEST_DELAY_MS);
	}
	await saveRatingsCache(cache);
}

let blobsUpdated = 0;
let itemsTouched = 0;

if (!dryRun) {
	for (const [key, raw] of blobs) {
		const defaultMediaType = defaultMediaTypeForKey(key);
		const touched = isCollectionPreviewBlob(raw)
			? Object.values(raw.children).reduce(
					(sum, child) =>
						sum +
						applyRatings(child.data as BackfillItem[], defaultMediaType, cache),
					0,
				)
			: applyRatings(collectItems(raw), defaultMediaType, cache);
		if (touched === 0) continue;
		try {
			await persistBlob(key, raw);
			blobsUpdated += 1;
			itemsTouched += touched;
			console.log(`💾 ${key}: ${touched} item(s)`);
		} catch (error) {
			console.error(`✗ write ${key}: ${(error as Error).message}`);
		}
	}
}

const remaining = [...missing.keys()].filter((key) => !cache.has(key)).length;
const daysLeft = remaining === 0 ? 0 : Math.ceil(remaining / dailyLimit);

console.log(
	`✅ fetched ${fetched}, failed ${failed}, blobs ${blobsUpdated}, items ${itemsTouched}, remaining ${remaining}${daysLeft > 0 ? ` (~${daysLeft} more day(s))` : ""}`,
);

if (hitLimit && remaining > 0) {
	console.log("👉 re-run tomorrow to continue");
}

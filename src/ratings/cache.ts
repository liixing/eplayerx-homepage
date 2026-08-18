import { getRawJson, putRawJson } from "../blocks/storage.js";
import type { ItemRatings } from "./types.js";
import { ratingsCacheKey } from "./types.js";

export const RATINGS_CACHE_KEY = "mdblist-ratings-cache.json";

export type RatingsCache = Map<string, ItemRatings>;

function isNotFound(error: unknown): boolean {
	if (!error || typeof error !== "object") return false;
	const status = (error as { $metadata?: { httpStatusCode?: number } })
		.$metadata?.httpStatusCode;
	const name = (error as { name?: string }).name;
	return status === 404 || name === "NoSuchKey" || name === "NotFound";
}

function parseCache(raw: unknown): RatingsCache {
	const map: RatingsCache = new Map();
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return map;
	for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
		if (!value || typeof value !== "object" || Array.isArray(value)) continue;
		map.set(key, value as ItemRatings);
	}
	return map;
}

export async function loadRatingsCache(): Promise<RatingsCache> {
	try {
		return parseCache(await getRawJson(RATINGS_CACHE_KEY));
	} catch (error) {
		if (isNotFound(error)) return new Map();
		throw error;
	}
}

export async function saveRatingsCache(cache: RatingsCache): Promise<void> {
	const payload: Record<string, ItemRatings> = {};
	for (const [key, value] of cache) {
		payload[key] = value;
	}
	await putRawJson(RATINGS_CACHE_KEY, payload);
}

export function cachedRatings(
	cache: RatingsCache,
	mediaType: "movie" | "tv",
	tmdbId: number,
): ItemRatings | undefined {
	return cache.get(ratingsCacheKey(mediaType, tmdbId));
}

let cachePromise: Promise<RatingsCache> | null = null;

/** Lazy R2 load; shared by publish, crawler, and live TMDB list enrich. */
export function getRatingsCache(): Promise<RatingsCache> {
	if (!cachePromise) {
		cachePromise = loadRatingsCache().catch((error) => {
			console.warn(
				"ratings cache unavailable, continuing without it:",
				error instanceof Error ? error.message : error,
			);
			return new Map();
		});
	}
	return cachePromise;
}

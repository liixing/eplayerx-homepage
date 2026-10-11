import { getTmdb } from "../tmdb/client.js";
import { loadRatingsCache, saveRatingsCache } from "./cache.js";
import { fetchItemRatings, MdblistRateLimitError } from "./mdblist.js";
import { ratingsCacheKey } from "./types.js";

/** Refresh all current Home titles, including previously empty or stale scores. */
export async function refreshTrendingRatings(): Promise<void> {
	const cache = await loadRatingsCache();
	let updated = 0;
	let failed = 0;
	try {
		for (const mediaType of ["tv", "movie"] as const) {
			const result = await getTmdb().GET(
				`/3/trending/${mediaType}/{time_window}`,
				{
					params: {
						path: { time_window: "day" },
						query: { language: "en-US", page: 1 },
					},
				},
			);
			if (!result.response.ok || !Array.isArray(result.data?.results)) {
				throw new Error(
					`Cannot load trending ${mediaType}: ${result.response.status}`,
				);
			}
			for (const item of result.data.results.slice(0, 20)) {
				const id = item.id;
				if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0)
					continue;
				try {
					const ratings = await fetchItemRatings(id, mediaType);
					const key = ratingsCacheKey(mediaType, id);
					// Missing provider scores must not erase previously known scores.
					const scored = Object.fromEntries(
						Object.entries(ratings).filter(
							([, value]) =>
								typeof value === "number" &&
								Number.isFinite(value) &&
								value > 0,
						),
					);
					cache.set(key, { ...cache.get(key), ...scored });
					updated++;
				} catch (error) {
					if (error instanceof MdblistRateLimitError) throw error;
					if ((error as { status?: number }).status === 404) continue;
					failed++;
					console.warn(`Ratings refresh failed: ${mediaType}/${item.id}`);
				}
			}
		}
	} finally {
		if (updated > 0) await saveRatingsCache(cache);
	}
	console.log(`Trending ratings: ${updated} refreshed, ${failed} failed`);
	if (failed > 0) throw new Error(`${failed} trending ratings requests failed`);
}

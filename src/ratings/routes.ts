import { type Context, Hono } from "hono";
import {
	fetchMdblistPayload,
	itemRatingsFromPayload,
	MdblistRateLimitError,
	parseMdblistApiKeys,
} from "./mdblist.js";

const ratingsApp = new Hono();

/** Ratings drift slowly; 1d cache, 6h stale-while-revalidate. */
const CACHE_CONTROL =
	"public, max-age=86400, s-maxage=86400, stale-while-revalidate=21600";

function defaultCache(): Cache | null {
	if (typeof caches === "undefined") return null;
	return (caches as unknown as { default?: Cache }).default ?? null;
}

export async function ratingsCacheMiddleware(
	c: Context,
	next: () => Promise<void>,
) {
	if (c.req.method !== "GET" && c.req.method !== "HEAD") {
		return next();
	}

	const cache = defaultCache();
	const cacheKey = new Request(c.req.url, { method: "GET" });
	if (cache) {
		const hit = await cache.match(cacheKey);
		if (hit) {
			const headers = new Headers(hit.headers);
			headers.set("Cache-Control", CACHE_CONTROL);
			return new Response(c.req.method === "HEAD" ? null : hit.body, {
				status: hit.status,
				headers,
			});
		}
	}

	await next();
	if (!c.res.ok) return;
	c.header("Cache-Control", CACHE_CONTROL);
	if (cache && c.req.method === "GET") {
		c.executionCtx.waitUntil(cache.put(cacheKey, c.res.clone()));
	}
}

function parseType(raw: string | undefined): "movie" | "tv" | null {
	if (raw === "movie" || raw === "tv") return raw;
	return null;
}

function parseTmdbId(raw: string | undefined): number | null {
	if (!raw) return null;
	if (!/^\d+$/.test(raw)) return null;
	const n = Number.parseInt(raw, 10);
	return n > 0 ? n : null;
}

function parseImdbId(raw: string | undefined): string | null {
	if (!raw) return null;
	const id = raw.trim();
	return /^tt\d+$/i.test(id) ? id : null;
}

function copyRateLimitHeaders(c: Context, upstream: Response) {
	for (const name of [
		"x-ratelimit-limit",
		"x-ratelimit-remaining",
		"x-ratelimit-reset",
	]) {
		const value = upstream.headers.get(name);
		if (value) c.header(name, value);
	}
}

ratingsApp.get("/", async (c) => {
	if (parseMdblistApiKeys().length === 0) {
		return c.json({ error: "MDBLIST_API_KEY is not set" }, 503);
	}

	const type = parseType(c.req.query("type"));
	if (!type) {
		return c.json({ error: "type is required (movie or tv)" }, 400);
	}

	const tmdbId = parseTmdbId(c.req.query("id"));
	const imdbId = parseImdbId(c.req.query("imdb"));
	if (!tmdbId && !imdbId) {
		return c.json({ error: "id (tmdb) or imdb is required" }, 400);
	}

	try {
		const { data, upstream } = await fetchMdblistPayload({
			mediaType: type,
			...(tmdbId ? { tmdbId } : { imdbId: imdbId ?? undefined }),
		});
		copyRateLimitHeaders(c, upstream);
		return c.json({
			title: data.title ?? null,
			year: data.year ?? null,
			type,
			ids: data.ids ?? {},
			score: data.score ?? null,
			scoreAverage: data.score_average ?? data.scoreaverage ?? null,
			ratings: Array.isArray(data.ratings) ? data.ratings : [],
			mapped: itemRatingsFromPayload(data),
		});
	} catch (error) {
		if (error instanceof MdblistRateLimitError) {
			return c.json({ error: error.message }, 429);
		}
		const status = (error as { status?: number }).status;
		if (status === 404) {
			return c.json({ error: "Not found" }, 404);
		}
		const message =
			error instanceof Error ? error.message : "MDBList request failed";
		return c.json({ error: message }, 502);
	}
});

export default ratingsApp;

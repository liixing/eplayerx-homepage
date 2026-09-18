import { type Context, Hono } from "hono";
import { loadSeriesCatalog } from "./catalog.js";

const tvdbApp = new Hono();

const CACHE_CONTROL =
	"public, max-age=43200, s-maxage=43200, stale-while-revalidate=10800";

function defaultCache(): Cache | null {
	if (typeof caches === "undefined") return null;
	return (caches as unknown as { default?: Cache }).default ?? null;
}

export async function tvdbCacheMiddleware(
	c: Context,
	next: () => Promise<void>,
) {
	if (c.req.method !== "GET" && c.req.method !== "HEAD") {
		return next();
	}
	const cache = defaultCache();
	const cacheKey = new Request(`${c.req.url}#20260918-tvdb-seasons`, {
		method: "GET",
	});
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

function parseId(raw: string | undefined): number | null {
	if (!raw || !/^\d+$/.test(raw)) return null;
	const id = Number.parseInt(raw, 10);
	return id > 0 ? id : null;
}

function parseSeasonNumber(raw: string | undefined): number | null {
	if (raw == null || raw === "" || !/^-?\d+$/.test(raw)) return null;
	return Number.parseInt(raw, 10);
}

tvdbApp.get("/tv/seasons", async (c) => {
	if (!process.env.TVDB_API_KEY) {
		return c.json({ error: "TVDB_API_KEY is not set" }, 500);
	}
	const id = parseId(c.req.query("id"));
	if (id == null) {
		return c.json({ error: "id is required" }, 400);
	}
	const language = c.req.query("language") || "en";
	try {
		const catalog = await loadSeriesCatalog(id, language);
		return c.json({
			seasons: catalog.seasons.map((season) => ({
				season_number: season.number,
				name: season.name,
				episode_count: season.episodeCount,
				air_date: season.airDate,
			})),
		});
	} catch (error) {
		return c.json(
			{ error: error instanceof Error ? error.message : "TVDB seasons failed" },
			500,
		);
	}
});

tvdbApp.get("/tv/season/episodes", async (c) => {
	if (!process.env.TVDB_API_KEY) {
		return c.json({ error: "TVDB_API_KEY is not set" }, 500);
	}
	const id = parseId(c.req.query("id"));
	const seasonNumber = parseSeasonNumber(c.req.query("seasonNumber"));
	if (id == null || seasonNumber == null) {
		return c.json({ error: "id and seasonNumber are required" }, 400);
	}
	const language = c.req.query("language") || "en";
	try {
		const catalog = await loadSeriesCatalog(id, language);
		const episodes = catalog.episodes.filter(
			(episode) => episode.seasonNumber === seasonNumber,
		);
		const season = catalog.seasons.find((item) => item.number === seasonNumber);
		return c.json({
			name: season?.name || "",
			overview: "",
			air_date: season?.airDate || episodes[0]?.airDate || "",
			episodes: episodes.map((episode) => ({
				id: episode.id,
				episode_number: episode.episodeNumber,
				name: episode.name,
				overview: episode.overview,
				air_date: episode.airDate,
				runtime: episode.runtime,
				still_path: episode.stillPath,
			})),
		});
	} catch (error) {
		return c.json(
			{
				error: error instanceof Error ? error.message : "TVDB episodes failed",
			},
			500,
		);
	}
});

export default tvdbApp;

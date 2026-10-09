import { Hono } from "hono";
import { tmdb } from "./client.js";

import { resolveTrailerCandidates, videoLanguages, type Details } from "./trailer-candidates.js";
export { trailerCandidates } from "./trailer-candidates.js";

const pending = new Map<string, Promise<Response>>();
const memory = new Map<string, { response: Response; expires: number }>();
const routes = new Hono();

routes.get("/:type/trailers", async c => {
	const type = c.req.param("type");
	const rawID = c.req.query("id") ?? "";
	const language = c.req.query("language") ?? "en-US";
	const id = Number(rawID);
	if (!/^[1-9]\d{0,9}$/.test(rawID) || !Number.isSafeInteger(id) || !["movie", "tv"].includes(type)
		|| !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(language)) {
		return c.json({ error: "Invalid type, id or language" }, 400);
	}
	// Canonical keys prevent arbitrary query parameters from multiplying cache entries.
	const key = `${type}/${id}/${language}`;
	const cacheKey = new Request(`https://api.eplayerx.com/tmdb/trailer-cache/v2/${key}`);
	const cache = typeof caches === "undefined" ? undefined : (caches as unknown as { default?: Cache }).default;
	const hit = memory.get(key);
	if (hit && hit.expires > Date.now()) return hit.response.clone();
	if (cache) {
		const edgeHit = await cache.match(cacheKey).catch(() => undefined);
		if (edgeHit) return edgeHit;
	}
	let job = pending.get(key);
	if (!job) {
		if (pending.size >= 64) return c.json({ error: "Busy" }, 503, { "Cache-Control": "no-store", "Retry-After": "5" });
		job = (async () => {
			// Fetch the App language first; resolve the original language only when needed.
			const query = { language, append_to_response: "videos", include_video_language: videoLanguages(language) };
			const result = type === "movie"
				? await tmdb.GET(`/3/movie/${id}`, { params: { path: { movie_id: id }, query } })
				: await tmdb.GET(`/3/tv/${id}`, { params: { path: { series_id: id }, query } });
			if (!result.response.ok && result.response.status !== 404) {
				return Response.json({ error: "Trailer metadata unavailable" }, { status: result.response.status === 429 ? 429 : 502,
					headers: { "Cache-Control": "no-store", "Retry-After": result.response.headers.get("Retry-After") ?? "5" } });
			}
			const details = result.data as Details | undefined;
			if (result.response.ok && details?.id !== id) throw new Error("Mismatched TMDB identity");
			const candidates = await resolveTrailerCandidates(details ?? {}, language, type as "movie" | "tv", query.include_video_language);
			const ttl = candidates.youtube.length ? 86400 : 600;
			const response = Response.json(candidates, { headers: { "Cache-Control": `public, max-age=${ttl}, s-maxage=${ttl}` } });
			if (memory.size >= 256) memory.delete(memory.keys().next().value!);
			memory.set(key, { response: response.clone(), expires: Date.now() + ttl * 1000 });
			if (cache) {
				try { await cache.put(cacheKey, response.clone()); } catch { /* Metadata remains usable when edge caching fails. */ }
			}
			return response;
		})().catch(() => Response.json({ error: "Trailer metadata unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } }));
		pending.set(key, job);
		void job.finally(() => { if (pending.get(key) === job) pending.delete(key); });
	}
	return (await job).clone();
});

export default routes;

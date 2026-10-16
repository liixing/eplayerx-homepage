import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import routes, { ratingsCacheMiddleware } from "./routes.js";

test("paid ratings use canonical cache keys and fail closed on missing/broken limits", async (t) => {
	const previousKey = process.env.MDBLIST_API_KEY;
	const previousCaches = globalThis.caches;
	process.env.MDBLIST_API_KEY = "test-key";
	t.after(() => {
		if (previousKey === undefined) delete process.env.MDBLIST_API_KEY;
		else process.env.MDBLIST_API_KEY = previousKey;
		Object.defineProperty(globalThis, "caches", { configurable: true, value: previousCaches });
	});
	const entries = new Map<string, Response>();
	Object.defineProperty(globalThis, "caches", { configurable: true, value: { default: {
		match: async (r: Request) => entries.get(r.url)?.clone(),
		put: async (r: Request, response: Response) => { entries.set(r.url, response); },
	} } });
	const fetch = t.mock.method(globalThis, "fetch", async () => {
		await new Promise(resolve => setTimeout(resolve, 5));
		return Response.json({ title: "Movie", ratings: [] });
	});
	let allowed = true;
	let broken = false;
	let limits = 0;
	const env = { RATINGS_RATE_LIMITER: { limit: async ({ key }: { key: string }) => {
		assert.equal(key, "ratings:192.0.2.1"); limits++;
		if (broken) throw new Error("unavailable");
		return { success: allowed };
	} } };
	const app = new Hono(); app.use("/ratings", ratingsCacheMiddleware); app.route("/ratings", routes);
	const request = (query: string, bindings: Record<string, unknown> = env, ip = "192.0.2.1") =>
		app.request("https://other.example/ratings?" + query, { headers: ip ? { "CF-Connecting-IP": ip } : {} }, bindings);
	const responses = await Promise.all(["type=movie&id=1", "unused=1&id=01&type=movie", "id=1&type=movie&imdb=tt123&unused=2"].map(query => request(query)));
	for (const response of responses) assert.equal(response.status, 200);
	assert.equal((await request("type=movie&id=1&unused=4")).status, 200);
	assert.equal(fetch.mock.callCount(), 1); assert.equal(limits, 1);
	assert.equal((await request("type=movie&imdb=TT123")).status, 200);
	assert.equal((await request("type=movie&imdb=tt123&unused=3")).status, 200);
	assert.equal(fetch.mock.callCount(), 2);
	assert.ok([...entries.keys()].every(key => new URL(key).searchParams.has("_cache_version")));
	allowed = false;
	const blocked = await request("type=movie&id=2");
	assert.equal(blocked.status, 429); assert.equal(blocked.headers.get("Retry-After"), "60");
	assert.equal(blocked.headers.get("Cache-Control"), "no-store");
	assert.equal((await request("type=movie&id=2", env, "")).status, 403);
	assert.equal((await request("type=movie&id=2", {})).status, 503);
	broken = true;
	assert.equal((await request("type=movie&id=2")).status, 503);
	assert.equal((await request("type=movie&id=9007199254740993")).status, 400);
	assert.equal(fetch.mock.callCount(), 2, "rejected requests never reach the paid provider");
	allowed = true; broken = false;
	assert.equal((await request("type=movie&id=2")).status, 200);
	assert.equal(fetch.mock.callCount(), 3, "rejected responses are never cached");
});

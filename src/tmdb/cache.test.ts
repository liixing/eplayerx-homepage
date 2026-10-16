import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import routes, { tmdbCacheMiddleware } from "./routes.js";

test("cold trending requests share enrichment and versioned entries survive fragment stripping", async (t) => {
	const previousToken = process.env.TMDB_API_TOKEN;
	const previousCaches = globalThis.caches;
	process.env.TMDB_API_TOKEN = "test-token";
	t.after(() => {
		if (previousToken === undefined) delete process.env.TMDB_API_TOKEN;
		else process.env.TMDB_API_TOKEN = previousToken;
		Object.defineProperty(globalThis, "caches", { configurable: true, value: previousCaches });
	});
	const entries = new Map<string, Response>();
	const key = (r: Request) => { const u = new URL(r.url); u.hash = ""; return u.href; };
	let cacheBroken = false;
	Object.defineProperty(globalThis, "caches", { configurable: true, value: { default: {
		match: async (r: Request) => entries.get(key(r))?.clone(),
		put: async (r: Request, response: Response) => {
			if (cacheBroken) throw new Error("cache unavailable");
			entries.set(key(r), response);
		},
	} } });
	let status = 200;
	const fetch = t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
		const url = new URL(input instanceof Request ? input.url : String(input));
		await new Promise(resolve => setTimeout(resolve, 5));
		return Response.json(url.pathname.includes("/trending/")
			? { results: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, original_language: "en" })) }
			: { id: Number(url.pathname.split("/").at(-1)), images: {}, videos: { results: [] } }, { status });
	});
	const app = new Hono(); app.use("/tmdb/*", tmdbCacheMiddleware); app.route("/tmdb", routes);
	const request = (query: string) => app.request("/tmdb/trending/tv?" + query);
	entries.set("http://localhost/tmdb/trending/tv?language=en-US&page=1", Response.json({ stale: true }));
	const responses = await Promise.all([request("language=en-US&page=1"), request("page=1&language=en-US")]);
	for (const response of responses) assert.equal((await response.json() as { results: unknown[] }).results.length, 20);
	assert.equal(fetch.mock.callCount(), 21, "two cold lists share the list and 20 details calls");
	assert.equal((await request("language=en-US&page=1")).status, 200);
	assert.equal(fetch.mock.callCount(), 21);
	assert.ok([...entries.keys()].some(url => new URL(url).searchParams.has("_cache_version")));
	status = 503;
	for (let i = 0; i < 2; i++) {
		const response = await request("language=en-US&page=2");
		assert.equal(response.status, 500); assert.equal(response.headers.get("Cache-Control"), "no-store");
	}
	assert.equal(fetch.mock.callCount(), 23, "failures are retried rather than retained in the pending map");
	status = 200; cacheBroken = true;
	assert.equal((await request("language=en-US&page=3")).status, 200);
});

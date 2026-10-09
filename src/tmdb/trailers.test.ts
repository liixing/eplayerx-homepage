import assert from "node:assert/strict";
import { test } from "node:test";
import routes, { trailerCandidates } from "./trailers.js";

test("App language wins, official trailers rank first, only original language is a fallback", () => {
 const video = { site: "YouTube", type: "Trailer", official: true, size: 1080, iso_639_1: "en" };
 const details = { original_language: "ja", videos: { results: [
  { ...video, key: "abcdefghij0", iso_639_1: "zh", official: false },
  { ...video, key: "abcdefghij1", iso_639_1: "zh", type: "Clip" },
  { ...video, key: "../../bad", iso_639_1: "zh" },
  { ...video, key: "abcdefghij2", iso_639_1: "ja" },
  { ...video, key: "abcdefghij3", iso_639_1: "zh" },
  { ...video, key: "abcdefghij3", iso_639_1: "zh" },
  { ...video, key: "abcdefghij4" },
  { ...video, key: "abcdefghij5", iso_639_1: "zh", type: "Teaser" },
 ] } };
 assert.deepEqual(trailerCandidates(details, "zh-TW"), { youtube: ["abcdefghij3", "abcdefghij5", "abcdefghij0"], language: "zh" });
 assert.deepEqual(trailerCandidates(details, "fr-FR"), { youtube: ["abcdefghij2"], language: "fr" });
 assert.deepEqual(trailerCandidates({ ...details, original_language: "ko" }, "fr-FR"), { youtube: [], language: "fr" });
 assert.deepEqual(trailerCandidates({ videos: { results: [{ ...video, key: "abcdefghij4" }] } }, "zh-CN"), { youtube: [], language: "zh" });
});

test("metadata uses one upstream request, coalesces, caches misses and retries errors", async () => {
	process.env.TMDB_API_TOKEN = "test";
	const originalFetch = globalThis.fetch;
	let count = 0;
	let status = 200;
	let empty = false;
	globalThis.fetch = async input => {
		count++;
		const url = new URL(input instanceof Request ? input.url : String(input));
		assert.equal(url.searchParams.get("append_to_response"), "videos");
		assert.equal(url.searchParams.get("include_video_language"), "zh");
		await new Promise(resolve => setTimeout(resolve, 5));
		return Response.json({ id: Number(url.pathname.split("/").at(-1)), original_language: "zh",
			videos: { results: empty ? [] : [{ key: "abcdefghij1", site: "YouTube", type: "Trailer", iso_639_1: "zh" }] } },
			{ status, headers: { "Retry-After": "9" } });
	};
	const request = (id: number, extra = "") => routes.request(`/movie/trailers?id=${id}&language=zh-CN${extra}`);
	try {
		const responses = await Promise.all([request(9001), request(9001)]);
		assert.equal(count, 1);
		assert.deepEqual(await responses[0].json(), await responses[1].json());
		assert.match(responses[0].headers.get("Cache-Control")!, /max-age=86400/);
		await request(9001, "&unused=123"); assert.equal(count, 1);
		empty = true;
		const missing = await request(9002);
		assert.match(missing.headers.get("Cache-Control")!, /max-age=600/);
		await request(9002); assert.equal(count, 2);
		status = 429;
		const limited = await request(9003);
		assert.equal(limited.status, 429); assert.equal(limited.headers.get("Retry-After"), "9");
		assert.equal(limited.headers.get("Cache-Control"), "no-store");
		status = 200;
		assert.equal((await request(9003)).status, 200); assert.equal(count, 4);
		for (const path of ["/person/trailers?id=1", "/movie/trailers?id=-1", "/movie/trailers?id=1x", "/tv/trailers?id=1&language=bad!"]) {
			assert.equal((await routes.request(path)).status, 400);
		}
		assert.equal(count, 4);
	} finally { globalThis.fetch = originalFetch; }
});


test("edge entries use canonical keys and survive local cache eviction", async () => {
    const originalCaches = globalThis.caches;
    const originalFetch = globalThis.fetch;
    let key = "";
    Object.defineProperty(globalThis, "caches", { configurable: true, value: { default: {
        match: async (request: Request) => { key = request.url; return Response.json({ youtube: ["abcdefghij1"], language: "en" }); },
    } } });
    globalThis.fetch = async () => { throw new Error("edge hit must not fetch TMDB"); };
    try {
        const response = await routes.request("/tv/trailers?unused=x&language=en-US&id=9009");
        assert.equal(response.status, 200);
        assert.equal(key, "https://api.eplayerx.com/tmdb/trailer-cache/v2/tv/9009/en-US");
        assert.deepEqual(await response.json(), { youtube: ["abcdefghij1"], language: "en" });
    } finally {
        Object.defineProperty(globalThis, "caches", { configurable: true, value: originalCaches });
        globalThis.fetch = originalFetch;
    }
});


test("unknown original language is queried once on a miss; known or present languages need no extra call", async () => {
 const { resolveTrailerCandidates } = await import("./trailer-candidates.js");
 const originalFetch = globalThis.fetch;
 let count = 0;
 globalThis.fetch = async input => {
  count++;
  const url = new URL(input instanceof Request ? input.url : String(input));
  assert.equal(url.pathname, "/3/tv/9010/videos");
  assert.equal(url.searchParams.get("language"), "ja");
  return Response.json({ id: 9010, results: [{ key: "abcdefghij2", site: "YouTube", type: "Trailer", official: true, iso_639_1: "ja" }] });
 };
 try {
  const details = { id: 9010, original_language: "ja", videos: { results: [] } };
  assert.deepEqual(await resolveTrailerCandidates(details, "zh-CN", "tv", "zh"), { youtube: ["abcdefghij2"], language: "zh" });
  assert.equal(count, 1);
  assert.deepEqual(await resolveTrailerCandidates(details, "zh-CN", "tv", "zh,ja"), { youtube: [], language: "zh" });
  assert.equal(count, 1);
  globalThis.fetch = async () => Response.json({}, { status: 429 });
  await assert.rejects(resolveTrailerCandidates(details, "zh-CN", "tv", "zh"));
 } finally { globalThis.fetch = originalFetch; }
});

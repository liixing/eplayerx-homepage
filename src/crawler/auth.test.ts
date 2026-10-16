import assert from "node:assert/strict";
import { test } from "node:test";
import app from "./index.js";

test("crawler writes require bearer auth; public snapshots stay readable", async (t) => {
	const previous = process.env.BLOCKS_ADMIN_PASSWORD;
	process.env.BLOCKS_ADMIN_PASSWORD = "test-admin";
	t.after(() => {
		if (previous === undefined) delete process.env.BLOCKS_ADMIN_PASSWORD;
		else process.env.BLOCKS_ADMIN_PASSWORD = previous;
	});
	const fetch = t.mock.method(globalThis, "fetch", async () => Response.json({ items: [] }));
	const credentials: Record<string, string>[] = [{}, { Authorization: "Bearer wrong" }, { Cookie: "blocks_admin=test-admin" }];
	for (const path of ["/crawl/movies", "/crawl/tv", "/crawl/douban/korean-tv", "/crawl/douban/japanese-tv",
		"/crawl/hami/taiwanese-tv", "/crawl/douban/animation", "/crawl/douban/hot-variety-shows", "/crawl/bangumi/animation", "/cron/crawl-all"]) {
		const method = path.startsWith("/cron") ? "GET" : "POST";
		for (const headers of credentials) {
			const response = await app.request(path, { method, headers });
			assert.equal(response.status, 401, path);
			assert.equal(response.headers.get("Cache-Control"), "no-store");
		}
	}
	assert.equal(fetch.mock.callCount(), 0);
	assert.equal((await app.request("/crawl/movies", {
		method: "POST", headers: { Authorization: "Bearer test-admin" },
	})).status, 200);
	assert.equal(fetch.mock.callCount(), 1);
	delete process.env.BLOCKS_ADMIN_PASSWORD;
	assert.equal((await app.request("/crawl/movies", {
		method: "POST", headers: { Authorization: "Bearer " },
	})).status, 401);
	assert.equal((await app.request("/popular/douban/movies", undefined, {
		ASSETS: { get: async () => ({ body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('{"data":[]}')); c.close(); } }),
			httpMetadata: {} }) } as unknown as R2Bucket,
	})).status, 200);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import routes, { tmdbCacheMiddleware } from "../tmdb/routes.js";

type ReviewResponse = {
	results: Record<string, unknown>[];
	total_results: number;
};

test("combined reviews preserve the legacy contract, source identity and short cold-cache TTL", async (t) => {
	const token = process.env.TMDB_API_TOKEN;
	process.env.TMDB_API_TOKEN = "test-token";
	t.after(() => {
		if (token === undefined) delete process.env.TMDB_API_TOKEN;
		else process.env.TMDB_API_TOKEN = token;
	});
	const upstream = [{ id: "tmdb-1", author: "Reviewer", content: "Review" }];
	t.mock.method(globalThis, "fetch", async () =>
		Response.json({
			id: 123,
			results: upstream,
			page: 1,
			total_results: 1,
			total_pages: 1,
		}),
	);
	const app = new Hono();
	app.use("/tmdb/*", tmdbCacheMiddleware);
	app.route("/tmdb", routes);
	const jobs: Promise<unknown>[] = [];
	const context = {
		waitUntil: (job: Promise<unknown>) => {
			jobs.push(job);
		},
		passThroughOnException() {},
	};
	let reads = 0;
	const env = {
		ASSETS: {
			get: async () => {
				reads++;
				return {
					json: async () => ({
						version: 1,
						sources: {
							douban: {
								sourceId: "1",
								retryAt: Date.now() + 86400000,
								results: [{ id: "2", source: "douban", content: "短评" }],
							},
							bahamut: {
								sourceId: null,
								retryAt: Date.now() + 86400000,
								results: [],
							},
						},
					}),
				};
			},
		},
	};
	const legacy = await app.request(
		"/tmdb/movie/reviews?id=123&language=en-US",
		{},
		env,
		context as ExecutionContext,
	);
	assert.deepEqual(((await legacy.json()) as ReviewResponse).results, upstream);
	assert.equal(reads, 0, "old apps never read or trigger extra sources");
	const combined = await app.request(
		"/tmdb/movie/reviews?id=123&language=en-US&sources=all",
		{},
		env,
		context as ExecutionContext,
	);
	const result = (await combined.json()) as ReviewResponse;
	assert.equal(result.results.length, 2);
	assert.equal(result.results[1].source, "douban");
	assert.equal(result.total_results, 2);
	assert.ok(combined.headers.get("Cache-Control")?.includes("max-age=300"));
	const empty = await app.request(
		"/tmdb/movie/reviews?id=124&language=en-US&sources=all",
		{},
		{},
		context as ExecutionContext,
	);
	assert.deepEqual(((await empty.json()) as ReviewResponse).results, upstream);
	assert.ok(empty.headers.get("Cache-Control")?.includes("max-age=30"));
	assert.equal(
		(await app.request("/tmdb/movie/reviews?id=9007199254740993&sources=all"))
			.status,
		400,
	);
	await Promise.all(jobs);
});

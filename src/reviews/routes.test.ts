import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import routes, { tmdbCacheMiddleware } from "../tmdb/routes.js";

type ReviewResponse = {
	results: Record<string, unknown>[];
	total_results: number;
};

test("client detail context obtains reviews without a redundant TMDB details request", async (t) => {
	process.env.TMDB_API_TOKEN ||= "test-token";
	const requested: string[] = [];
	t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
		const url = new URL(input instanceof Request ? input.url : String(input));
		requested.push(url.pathname);
		if (url.pathname.endsWith("/reviews"))
			return Response.json({
				results: [{ id: "tmdb", content: "Review" }],
				total_results: 1,
			});
		if (url.pathname.endsWith("/search"))
			return Response.json({
				subjects: {
					items: [
						{
							target_type: "movie",
							target: { id: "1234", title: "客户端片名", year: "2023" },
						},
					],
				},
			});
		assert.equal(url.pathname, "/rexxar/api/v2/movie/1234/interests");
		return Response.json({ interests: [{ id: "1", comment: "短评" }] });
	});
	const app = new Hono();
	app.route("/tmdb", routes);
	const query = new URLSearchParams({
		id: "9924",
		sources: "all",
		language: "zh-CN",
		context: JSON.stringify({
			titles: ["客户端片名"],
			year: 2023,
			animated: false,
		}),
	});
	const jobs: Promise<unknown>[] = [];
	const response = await app.request(
		`/tmdb/movie/reviews?${query}`,
		{},
		{ ASSETS: { get: async () => null, put: async () => {} } },
		{
			waitUntil: (job: Promise<unknown>) => {
				jobs.push(job);
			},
			passThroughOnException() {},
		} as ExecutionContext,
	);
	assert.equal(response.status, 200);
	assert.equal(((await response.json()) as ReviewResponse).results.length, 2);
	assert.equal(
		requested.length,
		3,
		"one review request, one search and one comments request",
	);
	await Promise.all(jobs);
});

test("season requests isolate supplementary comments but retain TMDB whole-show reviews", async (t) => {
	process.env.TMDB_API_TOKEN ||= "test-token";
	const requested: string[] = [],
		keys: string[] = [];
	t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
		const url = new URL(input instanceof Request ? input.url : String(input));
		requested.push(url.pathname);
		return Response.json({
			results: [{ id: "whole-show", content: "TMDB" }],
			total_results: 1,
		});
	});
	const env = {
		ASSETS: {
			get: async (key: string) => {
				keys.push(key);
				return {
					json: async () => ({
						version: 1,
						sources: {
							douban: {
								sourceId: "season-two",
								retryAt: Date.now() + 86400000,
								results: [{ id: "s2", source: "douban", content: "第二季" }],
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
	const jobs: Promise<unknown>[] = [];
	const context = {
		waitUntil: (job: Promise<unknown>) => {
			jobs.push(job);
		},
		passThroughOnException() {},
	};
	const app = new Hono();
	app.route("/tmdb", routes);
	const response = await app.request(
		"/tmdb/tv/reviews?id=9901&season=2&sources=all&language=en-US",
		{},
		env,
		context as ExecutionContext,
	);
	assert.equal(response.status, 200);
	assert.deepEqual(
		((await response.json()) as ReviewResponse).results.map((item) => item.id),
		["whole-show", "s2"],
	);
	assert.deepEqual(keys, ["reviews/v2/tv/9901/season/2.json"]);
	assert.deepEqual(requested, ["/3/tv/9901/reviews"]);
	for (const query of ["season=-1", "season=1.2", "season=", "season=1001"]) {
		assert.equal(
			(await app.request(`/tmdb/tv/reviews?id=9901&${query}&sources=all`))
				.status,
			400,
		);
	}
	assert.equal(
		(await app.request("/tmdb/movie/reviews?id=9901&season=1&sources=all"))
			.status,
		400,
	);
	await Promise.all(jobs);
});

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

test(
	"supplemental cache reads run alongside TMDB rather than waiting for its response",
	{ timeout: 1000 },
	async (t) => {
		const token = process.env.TMDB_API_TOKEN;
		process.env.TMDB_API_TOKEN = "test-token";
		t.after(() => {
			if (token === undefined) delete process.env.TMDB_API_TOKEN;
			else process.env.TMDB_API_TOKEN = token;
		});
		let release!: (value: Response) => void;
		const pending = new Promise<Response>((resolve) => {
			release = resolve;
		});
		t.mock.method(globalThis, "fetch", async () => pending);
		const env = {
			ASSETS: {
				get: async () => {
					release(
						Response.json({
							results: [{ id: "1", content: "TMDB" }],
							total_results: 1,
						}),
					);
					return {
						json: async () => ({
							version: 1,
							sources: {
								douban: {
									sourceId: "2",
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
		const app = new Hono();
		app.route("/tmdb", routes);
		const jobs: Promise<unknown>[] = [];
		const context = {
			waitUntil: (job: Promise<unknown>) => {
				jobs.push(job);
			},
			passThroughOnException() {},
		};
		const response = await app.request(
			"/tmdb/movie/reviews?id=901&language=en-US&sources=all",
			{},
			env,
			context as ExecutionContext,
		);
		assert.equal(((await response.json()) as ReviewResponse).results.length, 2);
		await Promise.all(jobs);
	},
);

test("the ten-second TMDB deadline returns cached comments instead of discarding them", async (t) => {
	const token = process.env.TMDB_API_TOKEN;
	process.env.TMDB_API_TOKEN = "test-token";
	t.after(() => {
		if (token === undefined) delete process.env.TMDB_API_TOKEN;
		else process.env.TMDB_API_TOKEN = token;
	});
	const controller = new AbortController();
	t.mock.method(AbortSignal, "timeout", (milliseconds: number) => {
		assert.equal(milliseconds, 10_000);
		return controller.signal;
	});
	t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
		const signal = (input as Request).signal;
		return new Promise<Response>((_resolve, reject) => {
			if (signal.aborted) return reject(new Error("Timed out"));
			signal.addEventListener("abort", () => reject(new Error("Timed out")), {
				once: true,
			});
		});
	});
	const app = new Hono();
	app.route("/tmdb", routes);
	const jobs: Promise<unknown>[] = [];
	const context = {
		waitUntil: (job: Promise<unknown>) => {
			jobs.push(job);
		},
		passThroughOnException() {},
	};
	const env = (results: unknown[]) => ({
		ASSETS: {
			get: async () => ({
				json: async () => ({
					version: 1,
					sources: {
						douban: { sourceId: "2", retryAt: Date.now() + 86400000, results },
						bahamut: {
							sourceId: null,
							retryAt: Date.now() + 86400000,
							results: [],
						},
					},
				}),
			}),
		},
	});
	const pending = app.request(
		"/tmdb/movie/reviews?id=902&language=en-US&sources=all",
		{},
		env([{ id: "2", source: "douban", content: "短评", likes: 8 }]),
		context as ExecutionContext,
	);
	controller.abort();
	const response = await pending;
	assert.equal(response.status, 200);
	assert.equal(
		((await response.json()) as ReviewResponse).results[0].source,
		"douban",
	);
	assert.ok(response.headers.get("Cache-Control")?.includes("max-age=30"));
	const empty = await app.request(
		"/tmdb/movie/reviews?id=903&language=en-US&sources=all",
		{},
		env([]),
		context as ExecutionContext,
	);
	assert.equal(empty.status, 504);
	await Promise.all(jobs);
});

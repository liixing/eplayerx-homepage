import assert from "node:assert/strict";
import { test } from "node:test";
import {
	createReviewCache,
	resolveTitle,
	type ReviewStorage,
} from "./cache.js";
import type { ExtraReview } from "./providers.js";

const review: ExtraReview = {
	id: "1",
	source: "douban",
	author: "读者",
	author_details: { name: "读者", avatar_path: null, rating: 8 },
	content: "测试评价",
	created_at: null,
	likes: 1,
	url: "https://movie.douban.com/",
};
const title = {
	type: "tv" as const,
	titles: ["测试"],
	year: 2023,
	animated: true,
};

test("season mappings use that season's premiere year and keep later seasons distinct", async (t) => {
	const token = process.env.TMDB_API_TOKEN;
	process.env.TMDB_API_TOKEN = "test-token";
	t.after(() => {
		if (token === undefined) delete process.env.TMDB_API_TOKEN;
		else process.env.TMDB_API_TOKEN = token;
	});
	const requests: string[] = [];
	t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
		const url = new URL(input instanceof Request ? input.url : String(input));
		requests.push(url.pathname);
		return Response.json({
			name: "测试",
			original_name: "Test",
			first_air_date: "2020-01-01",
			genres: [{ id: 16 }],
			seasons: [
				{ season_number: 1, name: "第1季", air_date: "2020-01-01" },
				{ season_number: 2, name: "第2季", air_date: "2023-01-01" },
			],
		});
	});
	const first = await resolveTitle("tv", 1, 1);
	const second = await resolveTitle("tv", 1, 2);
	assert.equal(first.year, 2020);
	assert.equal(second.year, 2023);
	assert.ok(first.titles.includes("测试"));
	assert.ok(!second.titles.includes("测试"));
	assert.ok(second.titles.includes("测试 第2季"));
	assert.ok(second.titles.includes("Test Season 2"));
	assert.deepEqual(second.searchTitles, ["测试", "Test"]);
	assert.deepEqual(
		requests,
		["/3/tv/1", "/3/tv/1", "/3/tv/1", "/3/tv/1"],
		"season metadata adds no requests",
	);
});

test("each season has isolated storage, source IDs and coalesced refreshes", async () => {
	const reads: string[] = [],
		writes = new Map<string, unknown>();
	const resolved: (number | undefined)[] = [];
	const cache = createReviewCache({
		resolveTitle: async (_type, _id, season) => {
			resolved.push(season);
			return { ...title, year: season === 1 ? 2020 : 2023 };
		},
		fetchers: {
			douban: async (title, previous) => {
				assert.equal(previous, undefined);
				return {
					sourceId: String(title.year),
					results: [{ ...review, id: String(title.year) }],
				};
			},
			bahamut: async () => ({ sourceId: null, results: [] }),
		},
	});
	const storage: ReviewStorage = {
		read: async (key) => {
			reads.push(key);
			return null;
		},
		write: async (key, value) => {
			writes.set(key, value);
		},
	};
	const jobs: Promise<void>[] = [];
	const load = (season: number) =>
		cache("tv", 1, storage, (job) => jobs.push(job), 1000, season);
	const [first, second, sameSecond] = await Promise.all([
		load(1),
		load(2),
		load(2),
	]);
	assert.equal(first[0]?.id, "2020");
	assert.equal(second[0]?.id, "2023");
	assert.deepEqual(second, sameSecond);
	assert.deepEqual(resolved.sort(), [1, 2]);
	assert.equal(reads.length, 2);
	await Promise.all(jobs);
	assert.deepEqual([...writes.keys()].sort(), [
		"reviews/v2/tv/1/season/1.json",
		"reviews/v2/tv/1/season/2.json",
	]);
	assert.deepEqual(
		await load(0),
		[],
		"specials never borrow a regular season mapping",
	);
});

test("cold requests return without crawling; concurrent requests share the refresh and warm reads reuse it", async () => {
	let release!: () => void;
	const blocked = new Promise<void>((resolve) => {
		release = resolve;
	});
	let lookups = 0,
		crawls = 0,
		reads = 0,
		writes = 0;
	const storage: ReviewStorage = {
		read: async () => {
			reads++;
			return null;
		},
		write: async () => {
			writes++;
		},
	};
	const cache = createReviewCache({
		resolveTitle: async () => {
			lookups++;
			return title;
		},
		fetchers: {
			douban: async () => {
				crawls++;
				await blocked;
				return { sourceId: "42", results: [review] };
			},
			bahamut: async () => ({ sourceId: null, results: [] }),
		},
	});
	const jobs: Promise<void>[] = [];
	const cold = await Promise.all(
		Array.from({ length: 10 }, () =>
			cache("tv", 1, storage, (job) => jobs.push(job)),
		),
	);
	assert.ok(cold.every((result) => result.length === 0));
	assert.equal(reads, 1);
	assert.equal(crawls, 1);
	release();
	await Promise.all(jobs);
	assert.deepEqual(await cache("tv", 1, storage, (job) => jobs.push(job)), [
		review,
	]);
	assert.equal(lookups, 1);
	assert.equal(writes, 1);
});

test("stale reviews return immediately and a failed provider cannot erase them or block the other provider", async () => {
	const old = {
		version: 1,
		sources: { douban: { sourceId: "42", results: [review], retryAt: 0 } },
	};
	let saved: unknown;
	const jobs: Promise<void>[] = [];
	const cache = createReviewCache({
		resolveTitle: async () => title,
		fetchers: {
			douban: async () => {
				throw new Error("403");
			},
			bahamut: async () => ({
				sourceId: "9",
				results: [{ ...review, id: "2", source: "bahamut" }],
			}),
		},
	});
	const storage = {
		read: async () => old,
		write: async (_: string, value: unknown) => {
			saved = value;
		},
	};
	assert.deepEqual(await cache("tv", 1, storage, (job) => jobs.push(job)), [
		review,
	]);
	await Promise.all(jobs);
	const snapshot = saved as {
		sources: Record<string, { results: ExtraReview[] }>;
	};
	assert.deepEqual(snapshot.sources.douban.results, [review]);
	assert.equal(snapshot.sources.bahamut.results[0].source, "bahamut");
	assert.equal(
		(await cache("tv", 1, storage, (job) => jobs.push(job))).length,
		2,
	);
});

test("slow or unavailable storage does not hold the response or start unpersistable crawls", async () => {
	let resolveRead!: (value: unknown) => void;
	const pending = new Promise((resolve) => {
		resolveRead = resolve;
	});
	const cache = createReviewCache();
	const jobs: Promise<void>[] = [];
	const start = performance.now();
	assert.deepEqual(
		await cache(
			"movie",
			1,
			{ read: () => pending, write: async () => {} },
			(job) => jobs.push(job),
		),
		[],
	);
	assert.ok(
		performance.now() - start < 500,
		"the 150ms read deadline bounds extra latency",
	);
	resolveRead({
		version: 1,
		sources: {
			douban: { results: [], retryAt: Date.now() + 10_000 },
			bahamut: { results: [], retryAt: Date.now() + 10_000 },
		},
	});
	await Promise.all(jobs);
	assert.deepEqual(
		await cache("movie", 2, null, () => {
			throw new Error("must not schedule");
		}),
		[],
	);
	assert.deepEqual(
		await cache(
			"movie",
			3,
			{
				read: async () => {
					throw new Error("down");
				},
				write: async () => {
					throw new Error("must not write");
				},
			},
			(job) => jobs.push(job),
		),
		[],
	);
	await Promise.all(jobs);
});

test("empty in-memory snapshots reload after 30 seconds when another isolate fills R2", async (t) => {
	let now = 1_000_000;
	t.mock.method(Date, "now", () => now);
	let snapshot: unknown = {
		version: 1,
		sources: {
			douban: { sourceId: null, results: [], retryAt: now + 86_400_000 },
			bahamut: { sourceId: null, results: [], retryAt: now + 86_400_000 },
		},
	};
	const cache = createReviewCache();
	const jobs: Promise<void>[] = [];
	const storage = { read: async () => snapshot, write: async () => {} };
	assert.deepEqual(
		await cache("movie", 1, storage, (job) => jobs.push(job)),
		[],
	);
	snapshot = {
		version: 1,
		sources: {
			douban: { sourceId: "12", results: [review], retryAt: now + 86_400_000 },
			bahamut: { sourceId: null, results: [], retryAt: now + 86_400_000 },
		},
	};
	now += 30_001;
	assert.deepEqual(await cache("movie", 1, storage, (job) => jobs.push(job)), [
		review,
	]);
	await Promise.all(jobs);
});

test("a cold foreground request includes both sources when their shared refresh finishes promptly", async () => {
	const cache = createReviewCache({
		resolveTitle: async () => title,
		fetchers: {
			douban: async () => ({ sourceId: "12", results: [review] }),
			bahamut: async () => ({
				sourceId: "13",
				results: [{ ...review, source: "bahamut" }],
			}),
		},
	});
	const jobs: Promise<void>[] = [];
	const results = await cache(
		"tv",
		1,
		{ read: async () => null, write: async () => {} },
		(job) => jobs.push(job),
		1000,
	);
	assert.deepEqual(
		results.map((item) => item.source),
		["douban", "bahamut"],
	);
	await Promise.all(jobs);
});

test("a slow provider cannot hide the source that finished before the foreground deadline", async () => {
	let release!: () => void;
	const pending = new Promise<void>((resolve) => {
		release = resolve;
	});
	const cache = createReviewCache({
		resolveTitle: async () => title,
		fetchers: {
			douban: async () => {
				await pending;
				return { sourceId: "12", results: [review] };
			},
			bahamut: async () => ({
				sourceId: "13",
				results: [{ ...review, source: "bahamut" }],
			}),
		},
	});
	const jobs: Promise<void>[] = [];
	const storage = { read: async () => null, write: async () => {} };
	const start = performance.now();
	const results = await cache("tv", 1, storage, (job) => jobs.push(job), 40);
	assert.deepEqual(
		results.map((item) => item.source),
		["bahamut"],
	);
	assert.ok(performance.now() - start < 500);
	release();
	await Promise.all(jobs);
	assert.equal(
		(await cache("tv", 1, storage, (job) => jobs.push(job))).length,
		2,
	);
});

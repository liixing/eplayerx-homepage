import assert from "node:assert/strict";
import { test } from "node:test";
import { createReviewCache, type ReviewStorage } from "./cache.js";
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

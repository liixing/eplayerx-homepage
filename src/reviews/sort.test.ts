import assert from "node:assert/strict";
import { test } from "node:test";
import { sortReviews } from "./sort.js";

test("all sources sort by likes descending, then newest, without changing the input", () => {
	const reviews = [
		{ id: "tmdb", created_at: "2025-01-01T00:00:00Z" },
		{ id: "douban-old", likes: 20, created_at: "2023-01-01T00:00:00Z" },
		{ id: "bahamut", likes: 40, created_at: "2022-01-01T00:00:00Z" },
		{ id: "douban-new", likes: 20, created_at: "2024-01-01T00:00:00Z" },
		{ id: "invalid", likes: Number.NaN, created_at: "bad date" },
	];
	assert.deepEqual(
		sortReviews(reviews).map((review) => review.id),
		["bahamut", "douban-new", "douban-old", "tmdb", "invalid"],
	);
	assert.equal(reviews[0].id, "tmdb");
});

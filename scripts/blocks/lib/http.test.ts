import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchBahamutQuarterly } from "./bahamut.js";
import { fetchEndataDayItems } from "./endata.js";
import { fetchWithRetry } from "./http.js";
import { fetchTraktListItems, fetchTraktTrendingItems } from "./trakt.js";

test("source retries are bounded, private lists fail clearly, and empty schedules differ from broken HTML", async () => {
	const originalFetch = globalThis.fetch;
	let calls = 0;
	try {
		globalThis.fetch = async () => {
			calls++;
			if (calls === 1) throw new TypeError("connection reset");
			return new Response("ok", {
				status: calls === 2 ? 503 : 200,
				headers: { "Retry-After": "0" },
			});
		};
		assert.equal((await fetchWithRetry("https://example.test")).status, 200);
		assert.equal(calls, 3);
		for (const status of [401, 403, 429, 500]) {
			calls = 0;
			globalThis.fetch = async () => {
				calls++;
				return new Response("error", {
					status,
					headers: { "Retry-After": "0" },
				});
			};
			assert.equal(
				(await fetchWithRetry("https://example.test")).status,
				status,
			);
			assert.equal(calls, status >= 429 ? 3 : 1);
		}
		calls = 0;
		globalThis.fetch = async () => {
			calls++;
			return new Response("", {
				status: 429,
				headers: { "Retry-After": "60" },
			});
		};
		assert.equal((await fetchWithRetry("https://example.test")).status, 429);
		assert.equal(calls, 1, "do not retry before Retry-After");
		const dates: string[] = [];
		globalThis.fetch = async (_input, init) => {
			dates.push(
				new URLSearchParams(init?.body as URLSearchParams).get("sDate") ?? "",
			);
			return new Response("", { status: 500, headers: { "Retry-After": "0" } });
		};
		await assert.rejects(fetchEndataDayItems(11), /endata empty\/unranked/);
		assert.equal(
			new Set(dates).size,
			4,
			"a failed date must not prevent trying earlier dates",
		);
		assert.equal(dates.length, 12, "three attempts per date");
		globalThis.fetch = async () =>
			new Response("List is private or does not exist", { status: 403 });
		await assert.rejects(
			fetchTraktListItems("snoak", "private", "movies"),
			/403: List is private/,
		);
		for (const type of ["movies", "shows"] as const) {
			globalThis.fetch = async (input) => {
				assert.equal(new URL(String(input)).pathname, `/${type}/trending`);
				return Response.json([
					{
						[type === "movies" ? "movie" : "show"]: {
							title: "Title",
							ids: { tmdb: 42 },
						},
					},
				]);
			};
			assert.deepEqual(await fetchTraktTrendingItems(type), [
				{ title: "Title", tmdbId: 42 },
			]);
		}
		globalThis.fetch = async () =>
			new Response('<ul class="ACG-maintag"></ul>');
		assert.deepEqual(await fetchBahamutQuarterly(1), []);
		globalThis.fetch = async () =>
			new Response(
				'<ul class="ACG-maintag"></ul><div class="ACG-mainbox2B"><img alt="中文,日本語,English, subtitle"></div>',
			);
		assert.deepEqual(await fetchBahamutQuarterly(1), [
			{ title: "日本語", altTitles: ["中文", "English, subtitle"] },
		]);
		globalThis.fetch = async () =>
			new Response(
				'<ul class="ACG-maintag"></ul><div class="ACG-mainbox2B">changed markup</div>',
			);
		await assert.rejects(fetchBahamutQuarterly(1), /could not be parsed/);
		globalThis.fetch = async () => new Response("challenge page");
		await assert.rejects(fetchBahamutQuarterly(1), /unexpected HTML/);
	} finally {
		globalThis.fetch = originalFetch;
	}
});

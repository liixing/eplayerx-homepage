import assert from "node:assert/strict";
import { test } from "node:test";
import {
	fetchDetailsWithEnrichment,
	searchTMDB,
} from "../crawler/tmdb-enrich.js";
import { createTmdbClient, createTmdbFetch } from "./client.js";

test("publishing retries a rejected token once, remembers the fallback and exposes upstream failures", async () => {
	const originalFetch = globalThis.fetch;
	const calls: string[] = [];
	let status = 200;
	globalThis.fetch = async (input) => {
		const request = input as Request;
		const authorization = request.headers.get("Authorization") ?? "";
		calls.push(authorization);
		assert.equal(new URL(request.url).searchParams.get("language"), "zh-CN");
		return Response.json(
			authorization === "Bearer expired"
				? {}
				: {
						id: 42,
						results: [{ id: 42 }],
					},
			{ status: authorization === "Bearer expired" ? 401 : status },
		);
	};
	try {
		const client = createTmdbClient("expired", "admin");
		assert.equal((await searchTMDB("Title", "movie", {}, client))?.id, 42);
		assert.equal(
			(await fetchDetailsWithEnrichment(42, "movie", "zh-CN", client))?.tmdbData
				.id,
			42,
		);
		assert.deepEqual(calls, ["Bearer expired", "Bearer admin", "Bearer admin"]);
		calls.length = 0;
		await assert.rejects(
			searchTMDB("Title", "movie", {}, createTmdbClient("expired")),
			/TMDB HTTP 401/,
		);
		assert.deepEqual(calls, ["Bearer expired"], "no implicit admin fallback");
		for (const failure of [401, 403, 429, 503]) {
			status = failure;
			calls.length = 0;
			await assert.rejects(
				searchTMDB("Title", "movie", {}, createTmdbClient("expired", "admin")),
				new RegExp(`TMDB HTTP ${failure}`),
			);
			assert.deepEqual(
				calls,
				["Bearer expired", "Bearer admin"],
				"failed fallback never loops",
			);
		}
		status = 403;
		calls.length = 0;
		await assert.rejects(
			searchTMDB("Title", "movie", {}, createTmdbClient("restricted", "admin")),
			/TMDB HTTP 403/,
		);
		assert.deepEqual(
			calls,
			["Bearer restricted"],
			"403 must not change identity",
		);
		status = 401;
		await assert.rejects(
			fetchDetailsWithEnrichment(
				42,
				"movie",
				"zh-CN",
				createTmdbClient("admin"),
			),
			/TMDB HTTP 401/,
		);
		status = 404;
		globalThis.fetch = async () => Response.json({}, { status });
		assert.equal(
			await fetchDetailsWithEnrichment(42, "movie", "zh-CN", client),
			null,
		);
		globalThis.fetch = async () => {
			throw new TypeError("connection reset");
		};
		await assert.rejects(
			searchTMDB("Title", "movie", {}, client),
			/connection reset/,
		);
		await assert.rejects(
			fetchDetailsWithEnrichment(42, "movie", "zh-CN", client),
			/connection reset/,
		);
		status = 200;
		globalThis.fetch = async (input) => {
			const request = input as Request;
			assert.equal(request.headers.get("Accept"), "application/json");
			assert.equal(request.headers.get("Authorization"), "Bearer admin");
			return Response.json({ results: [] });
		};
		assert.equal(
			(
				await createTmdbFetch("admin")(
					"https://api.themoviedb.org/3/discover/tv",
					{ headers: { Accept: "application/json" } },
				)
			).status,
			200,
		);
	} finally {
		globalThis.fetch = originalFetch;
	}
});

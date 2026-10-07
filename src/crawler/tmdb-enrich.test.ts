import assert from "node:assert/strict";
import { test } from "node:test";
import {
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { createTmdbClient } from "../tmdb/client.js";
import { searchTMDB } from "./tmdb-enrich.js";

test("country constraints reject same-title imports and survive publish fallbacks", async (t) => {
	const originalFetch = globalThis.fetch;
	const originalBucket = process.env.R2_BUCKET_NAME;
	const originalPassword = process.env.BLOCKS_ADMIN_PASSWORD;
	process.env.R2_BUCKET_NAME = "test-country-filter";
	process.env.BLOCKS_ADMIN_PASSWORD = "test-password";
	const { publishBlock } = await import("../blocks/publish.js");
	const uploads: string[] = [];
	t.mock.method(S3Client.prototype, "send", async (command: unknown) => {
		if (command instanceof GetObjectCommand) {
			return { Body: { transformToString: async () => "{}" } };
		}
		assert.ok(command instanceof PutObjectCommand);
		uploads.push(String(command.input.Body));
		return {};
	});
	const client = createTmdbClient("test-token");
	const calls: URL[] = [];
	let results: Record<string, unknown>[] = [];
	let details: Record<string, unknown> = {};
	globalThis.fetch = async (input) => {
		const url = new URL(input instanceof Request ? input.url : String(input));
		calls.push(url);
		assert.ok(
			url.pathname.startsWith("/3/"),
			"must never publish during tests",
		);
		return Response.json(
			url.pathname.includes("/search/") ? { results } : details,
		);
	};
	try {
		results = [
			{ id: 1, media_type: "tv", origin_country: ["CN"], genre_ids: [16] },
			{ id: 2, media_type: "tv", original_language: "en" },
			{ id: 3, media_type: "movie", origin_country: ["US"] },
			{ id: 4, media_type: "tv", origin_country: ["US"], genre_ids: [18] },
			{
				id: 5,
				media_type: "tv",
				origin_country: ["CA", "US"],
				genre_ids: [16],
			},
		];
		assert.equal((await searchTMDB("同名", "tv", {}, client))?.id, 1);
		assert.equal(
			(await searchTMDB("同名", "tv", { requireOriginCountries: [] }, client))
				?.id,
			1,
		);
		assert.equal(
			(
				await searchTMDB(
					"同名",
					"tv",
					{ requireOriginCountries: ["US"] },
					client,
				)
			)?.id,
			4,
		);
		assert.equal(
			(
				await searchTMDB(
					"同名",
					"tv",
					{
						requireOriginCountries: ["GB", "US"],
						requireTvGenreIds: [16],
					},
					client,
				)
			)?.id,
			5,
		);
		assert.equal(
			await searchTMDB(
				"同名",
				"tv",
				{ requireOriginCountries: ["JP"] },
				client,
			),
			null,
		);
		assert.ok(
			calls.every((url) => url.pathname === "/3/search/multi"),
			"TV countries need no extra requests",
		);

		results = [
			{ id: 6, release_date: "1990-01-01" },
			{ id: 7, release_date: "2020-01-01" },
			{ id: 8, release_date: "2021-01-01" },
		];
		globalThis.fetch = async (input) => {
			const url = new URL(input instanceof Request ? input.url : String(input));
			calls.push(url);
			if (url.pathname.includes("/search/")) return Response.json({ results });
			assert.notEqual(
				url.pathname,
				"/3/movie/6",
				"year filtering runs before country details",
			);
			return Response.json({
				origin_country: url.pathname.endsWith("/7") ? ["US"] : ["JP"],
			});
		};
		calls.length = 0;
		assert.equal(
			(
				await searchTMDB(
					"同名电影",
					"movie",
					{ year: 2020, requireOriginCountries: ["JP"] },
					client,
				)
			)?.id,
			8,
		);
		assert.deepEqual(
			calls.map((url) => url.pathname),
			["/3/search/movie", "/3/movie/7", "/3/movie/8"],
		);
		calls.length = 0;
		assert.equal(
			(await searchTMDB("同名电影", "movie", { year: 2020 }, client))?.id,
			7,
		);
		assert.equal(calls.length, 1, "unrestricted movies do not fetch details");

		globalThis.fetch = async (input) => {
			const url = new URL(input instanceof Request ? input.url : String(input));
			calls.push(url);
			assert.ok(
				url.pathname.startsWith("/3/"),
				"must never publish during tests",
			);
			return Response.json(
				url.pathname.includes("/search/") ? { results } : details,
			);
		};
		results = [{ id: 1, media_type: "tv", origin_country: ["CN"] }];
		calls.length = 0;
		const options = {
			tmdbToken: "test-token",
			blockId: "test-country-filter",
			mediaType: "tv" as const,
			requireOriginCountries: ["US"],
			fetchItems: async () => [
				{ title: "同名 第二季", altTitles: ["Alias"], year: 2026 },
			],
		};
		await assert.rejects(
			publishBlock({ ...options, fetchItems: async () => [] }),
			/Source returned no titles/,
		);
		assert.equal(calls.length, 0, "empty sources must not trigger TMDB search");
		await assert.rejects(publishBlock(options), /No items resolved/);
		assert.deepEqual(
			calls.map((url) => url.searchParams.get("query")),
			["同名 第二季", "Alias", "同名", "同名 第二季", "Alias", "同名"],
			"country constraints must survive alias, season and year fallback searches",
		);
		details = { id: 1, origin_country: ["CN"] };
		await assert.rejects(
			publishBlock({
				...options,
				fetchItems: async () => [{ title: "固定 ID", tmdbId: 1 }],
			}),
			/No items resolved/,
		);
		results = [{ id: 1, media_type: "tv", origin_country: ["US"] }];
		for (const origin_country of [["CN"], [], undefined]) {
			details = { id: 1, origin_country };
			await assert.rejects(
				publishBlock({
					...options,
					fetchItems: async () => [{ title: "Search/detail disagreement" }],
				}),
				/No items resolved/,
			);
		}
		details = { id: 1 };
		results = [{ id: 1 }];
		assert.equal(
			await searchTMDB(
				"缺少国家",
				"movie",
				{ requireOriginCountries: ["JP"] },
				client,
			),
			null,
		);
		assert.equal(
			uploads.length,
			0,
			"no upload when all candidates are rejected",
		);

		// Known ids remain usable when TMDB omits country metadata (e.g. 氪金玩家).
		calls.length = 0;
		globalThis.fetch = async (input) => {
			const url = new URL(input instanceof Request ? input.url : String(input));
			calls.push(url);
			if (url.pathname === "/3/search/multi") {
				return Response.json({
					results: [{ id: 2, media_type: "tv", origin_country: ["US"] }],
				});
			}
			if (url.pathname === "/3/tv/2")
				return Response.json({
					id: 2,
					name: "US show",
					origin_country: ["US"],
				});
			if (url.pathname === "/3/tv/3")
				return Response.json({ id: 3, name: "Known show", origin_country: [] });
			if (url.pathname === "/3/movie/4")
				return Response.json({ id: 4, title: "Known movie" });
			if (url.pathname === "/blocks/import-payload")
				return Response.json({ title: "Test block" });
			assert.equal(url.pathname, "/admin/api/report");
			return Response.json({});
		};
		const published = await publishBlock({
			...options,
			useTmdbTitle: true,
			fetchItems: async () => [
				{ title: "Search result" },
				{ title: "Pinned TV", tmdbId: 3 },
				{ title: "Pinned movie", tmdbId: 4, mediaType: "movie" },
			],
		});
		assert.equal(published.itemCount, 3);
		assert.equal(uploads.length, 1);
		const snapshot = JSON.parse(uploads[0]);
		assert.equal(snapshot.title, "Test block");
		assert.deepEqual(
			snapshot.data.map((item: { tmdbId: number; media_type: string }) => [
				item.tmdbId,
				item.media_type,
			]),
			[
				[2, "tv"],
				[3, "tv"],
				[4, "movie"],
			],
		);
		assert.equal(
			calls.filter((url) => url.pathname.includes("/search/")).length,
			1,
			"pinned ids bypass search",
		);
	} finally {
		globalThis.fetch = originalFetch;
		if (originalBucket === undefined) delete process.env.R2_BUCKET_NAME;
		else process.env.R2_BUCKET_NAME = originalBucket;
		if (originalPassword === undefined)
			delete process.env.BLOCKS_ADMIN_PASSWORD;
		else process.env.BLOCKS_ADMIN_PASSWORD = originalPassword;
	}
});

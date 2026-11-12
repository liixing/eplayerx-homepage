import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchRecentHotItems } from "./douban.js";
import { fetchTmdbDiscoverItems } from "./tmdb-discover.js";
import { fetchTmdbListItems } from "./tmdb-list.js";

test("submission sources preserve filters, paginate lists, and retain Douban years", async () => {
	const originalFetch = globalThis.fetch;
	try {
		const pages: number[] = [];
		globalThis.fetch = async (input) => {
			const page = Number(
				new URL((input as Request).url).searchParams.get("page"),
			);
			pages.push(page);
			return Response.json({
				total_pages: 2,
				items:
					page === 1
						? [
								{
									id: 1,
									name: "Thai show",
									media_type: "tv",
									origin_country: ["TH"],
								},
								{
									id: 2,
									name: "Other show",
									media_type: "tv",
									origin_country: ["US"],
								},
								{
									id: 3,
									title: "Movie",
									media_type: "movie",
									origin_country: ["TH"],
								},
							]
						: [
								{
									id: 4,
									name: "Next show",
									media_type: "tv",
									origin_country: ["TH"],
								},
							],
			});
		};
		assert.deepEqual(await fetchTmdbListItems("token", 42, "tv", "TH"), [
			{ title: "Thai show", tmdbId: 1, mediaType: "tv" },
			{ title: "Next show", tmdbId: 4, mediaType: "tv" },
		]);
		assert.deepEqual(pages, [1, 2]);
		globalThis.fetch = async () => Response.json({ items: [] });
		await assert.rejects(fetchTmdbListItems("token", 42, "tv"), /invalid page/);
		globalThis.fetch = async () => new Response("denied", { status: 403 });
		await assert.rejects(fetchTmdbListItems("token", 42, "tv"), /403/);
		globalThis.fetch = async (input) => {
			const params = new URL((input as Request).url).searchParams;
			assert.equal(params.get("with_origin_country"), "HK");
			assert.equal(params.get("primary_release_date.gte"), "2023-01-01");
			assert.equal(params.get("certification_country"), "US");
			assert.equal(params.get("certification.lte"), "PG");
			return Response.json({
				results: [{ id: 5, title: "Film", poster_path: "/p.jpg" }],
			});
		};
		assert.deepEqual(
			await fetchTmdbDiscoverItems(
				"token",
				"movie",
				{
					withOriginCountry: "HK",
					primaryReleaseDateGte: "2023-01-01",
					certificationCountry: "US",
					certificationLte: "PG",
				},
				"zh-CN",
			),
			[{ title: "Film", tmdbId: 5, mediaType: "movie" }],
		);
		for (const kind of ["movie", "tv"] as const) {
			globalThis.fetch = async (input) => {
				const url = new URL(String(input));
				assert.equal(
					url.searchParams.get("type"),
					kind === "movie" ? "全部" : "tv",
				);
				return Response.json({
					items: [
						{
							title: "A Title 第2季",
							card_subtitle: "2026 / 中国",
							type: kind,
						},
						{ title: "Wrong media", type: kind === "movie" ? "tv" : "movie" },
					],
				});
			};
			assert.deepEqual(await fetchRecentHotItems(kind), [
				{ title: "A Title 第2季", year: 2026, mediaType: kind },
			]);
		}
		globalThis.fetch = async () => new Response("denied", { status: 403 });
		await assert.rejects(fetchRecentHotItems("tv"), /403/);
	} finally {
		globalThis.fetch = originalFetch;
	}
});

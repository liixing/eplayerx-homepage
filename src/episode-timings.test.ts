import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sign } from "hono/jwt";
import app from "./index.js";

const { test } = require("bun:test");

test("one episode endpoint shares ads and markers without crossing episodes", async () => {
	const { Database } = require("bun:sqlite");
	const sqlite = new Database(":memory:");
	sqlite.exec(
		readFileSync(
			new URL("../migrations/0012_episode_timings.sql", import.meta.url),
			"utf8",
		),
	);
	sqlite.exec(`INSERT INTO screen_ad_segments VALUES
		(10, 1, 1, 100000, 120000), (10, 1, 1, 130000, 150000),
		(338938, 1, 1, 123580, 130680), (338938, 1, 1, 134780, 142320),
		(338938, 1, 1, 231020, 242000), (338938, 1, 1, 246020, 257720),
		(338938, 1, 2, 123580, 130680)`);
	sqlite.exec(
		"INSERT INTO episode_intro_outro VALUES (10, 1, 1, 55000, 1950000)",
	);
	sqlite.exec(
		readFileSync(
			new URL("../migrations/0013_one_ad_per_episode.sql", import.meta.url),
			"utf8",
		),
	);
	sqlite.exec(
		readFileSync(
			new URL("../migrations/0014_episode_marker_ranges.sql", import.meta.url),
			"utf8",
		),
	);
	sqlite.exec(
		readFileSync(
			new URL("../migrations/0015_confirmed_no_ads.sql", import.meta.url),
			"utf8",
		),
	);
	sqlite.exec(
		readFileSync(
			new URL("../migrations/0016_playback_timing_rules.sql", import.meta.url),
			"utf8",
		),
	);
	sqlite.exec(
		readFileSync(
			new URL(
				"../migrations/0017_playback_timing_members.sql",
				import.meta.url,
			),
			"utf8",
		),
	);
	sqlite.exec(
		"INSERT INTO playback_timing_rules (tmdb_id, season, episode, no_ads) VALUES (99, -1, 0, 1)",
	);
	sqlite.exec(
		readFileSync(
			new URL(
				"../migrations/0018_playback_timing_seasons.sql",
				import.meta.url,
			),
			"utf8",
		),
	);
	assert.equal(
		sqlite
			.query("SELECT no_ads FROM playback_timing_rules WHERE tmdb_id = 99")
			.get().no_ads,
		1,
	);
	sqlite.exec(
		readFileSync(
			new URL("../migrations/0019_ad_video_duration.sql", import.meta.url),
			"utf8",
		),
	);

	sqlite.exec(
		readFileSync(
			new URL("../migrations/0020_relaxed_ad_ranges.sql", import.meta.url),
			"utf8",
		),
	);

	sqlite.exec(
		readFileSync(
			new URL("../migrations/0025_episode_rule_duration.sql", import.meta.url),
			"utf8",
		),
	);
	for (const file of ["0021_ad_scan_requests.sql", "0022_ad_scan_airing.sql"]) {
		sqlite.exec(
			readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8"),
		);
	}
	sqlite.exec(`INSERT INTO ad_scan_requests (id, tmdb_id, title, position, ongoing)
		VALUES ('example', 94, '广告跟踪示例', 'midroll', 1)`);
	sqlite.exec(
		readFileSync(
			new URL("../migrations/0023_ad_scan_by_series.sql", import.meta.url),
			"utf8",
		),
	);
	sqlite.exec(
		readFileSync(
			new URL(
				"../migrations/0024_episode_marker_duration.sql",
				import.meta.url,
			),
			"utf8",
		),
	);
	sqlite.exec(
		readFileSync(
			new URL("../migrations/0026_ad_scan_completions.sql", import.meta.url),
			"utf8",
		),
	);

	sqlite.exec(
		`UPDATE ad_scan_requests SET catalog_json = '{"posterPath":"/poster.jpg","year":"2023"}'`,
	);
	sqlite.exec(
		"INSERT INTO screen_ad_series VALUES (10, 1, 4102444800), (11, 0, 4102444800)",
	);
	type Value = number | string | null;
	let statements = 0;
	const db = {
		batch(queries: { run: () => unknown }[]) {
			return sqlite.transaction(() => queries.map((query) => query.run()))();
		},
		prepare(sql: string) {
			statements++;
			const query = sqlite.query(sql);
			const bound = (...params: Value[]) => ({
				first: (column?: string) => {
					const row = query.get(...params);
					return (column ? row?.[column] : row) ?? null;
				},
				all: () => ({ results: query.all(...params) }),
				run: () => ({ meta: { changes: query.run(...params).changes } }),
			});
			return { ...bound(), bind: bound };
		},
	};
	const owner = "owner@example.com";
	const editor = "editor@example.com";
	const issuer = "https://episode-timing-test.cloudflareaccess.com";
	const audience = "test-timing-audience";
	const pair = await crypto.subtle.generateKey(
		{
			name: "RSASSA-PKCS1-v1_5",
			modulusLength: 2048,
			publicExponent: new Uint8Array([1, 0, 1]),
			hash: "SHA-256",
		},
		true,
		["sign", "verify"],
	);
	const publicKey = {
		...(await crypto.subtle.exportKey("jwk", pair.publicKey)),
		kid: "test-key",
		alg: "RS256" as const,
	};
	const privateKey = {
		...(await crypto.subtle.exportKey("jwk", pair.privateKey)),
		kid: "test-key",
		alg: "RS256" as const,
	};
	const token = (
		email: string,
		aud = audience,
		exp = Math.floor(Date.now() / 1000) + 600,
	) => sign({ email, iss: issuer, aud: [aud], exp, type: "app" }, privateKey);
	const ownerToken = await token(owner);
	const editorToken = await token(editor);
	const originalFetch = globalThis.fetch;
	globalThis.fetch = Object.assign(
		async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = input instanceof Request ? input.url : String(input);
			if (url === `${issuer}/cdn-cgi/access/certs`)
				return Response.json({ keys: [publicKey] });
			if (url.startsWith("https://api.themoviedb.org/3/tv/94?")) {
				return Response.json({
					name: "特别篇示例",
					seasons: [{ season_number: 0, episode_count: 2 }],
				});
			}
			if (url.startsWith("https://api.themoviedb.org/3/tv/94/season/0?")) {
				return Response.json({
					episodes: [
						{ episode_number: 2, name: "序章" },
						{ episode_number: 4, name: "终章" },
					],
				});
			}
			if (url.includes("/3/tv/13"))
				return Response.json({ origin_country: ["CN"] });
			if (url.startsWith("https://api.themoviedb.org/"))
				return new Response(null, { status: 404 });
			return originalFetch(input, init);
		},
		originalFetch,
	);

	const env = {
		DB: db,
		TIMING_OWNER_EMAIL: owner,
		TIMING_ACCESS_ISSUER: issuer,
		TIMING_ACCESS_AUDIENCE: audience,
		EPISODE_TIMING_RATE_LIMITER: { limit: async () => ({ success: true }) },
	};
	const key = { tmdbId: 10, season: 1, episode: 2 };
	const endpoint = "/episode-timings";
	const get = (query: string) =>
		app.request(
			`${endpoint}?${query}`,
			{ headers: { "CF-Connecting-IP": "192.0.2.1" } },
			env,
		);
	const post = (fields: Record<string, unknown>) =>
		app.request(
			endpoint,
			{
				method: "POST",
				headers: {
					"CF-Connecting-IP": "192.0.2.1",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					...key,
					durationMs: 2_000_000,
					...fields,
				}),
			},
			env,
		);
	const query = "tmdbId=10&season=1&episode=2&durationMs=2000000";
	const getAdState = async (query: string) => {
		const payload = (await (await get(query)).json()) as {
			ads: {
				eligible: boolean;
				scanComplete: boolean;
				segments: { startMs: number; endMs: number }[];
			};
		};
		return payload.ads;
	};
	const getAdSegments = async (query: string) =>
		(await getAdState(query)).segments;
	const empty = { introEndMs: null, outroStartMs: null };
	const adminURL = "http://localhost/admin/episode-timings";
	const admin = (path = "", assertion = ownerToken) =>
		app.request(
			`${adminURL}${path}`,
			{ headers: { "Cf-Access-Jwt-Assertion": assertion } },
			env,
		);
	const memberChange = (
		action: string,
		email: string,
		assertion = ownerToken,
	) =>
		app.request(
			`${adminURL}/members`,
			{
				method: "POST",
				headers: {
					Origin: "http://localhost",
					"Cf-Access-Jwt-Assertion": assertion,
				},
				body: new URLSearchParams({ action, email }),
			},
			env,
		);
	const save = (
		fields: Record<string, string>,
		assertion = ownerToken,
		origin = "http://localhost",
	) =>
		app.request(
			`${adminURL}/save`,
			{
				method: "POST",
				headers: { origin, "Cf-Access-Jwt-Assertion": assertion },
				body: new URLSearchParams({
					tmdbId: "10",
					season: "1",
					episode: "2",
					duration: "33:20",
					...fields,
				}),
			},
			env,
		);
	try {
		assert.equal((await admin("/ad-requests", "")).status, 401);
		assert.equal((await admin("/ad-requests", editorToken)).status, 403);
		const adRequests = await admin("/ad-requests");
		assert.equal(adRequests.status, 200);
		const adRequestsHTML = await adRequests.text();
		assert.match(adRequestsHTML, /广告跟踪示例/);
		assert.match(adRequestsHTML, /2023 ·/);
		assert.match(adRequestsHTML, /w92\/poster.jpg/);
		assert.doesNotMatch(adRequestsHTML, /剧中广告|片头广告/);
		assert.match(adRequestsHTML, /下次检查/);
		assert.deepEqual(
			sqlite.query("SELECT * FROM screen_ad_segments").values(),
			[
				[10, 1, 1, 100000, 120000, 0],
				[338938, 1, 2, 123580, 130680, 0],
			],
		);
		for (const duration of ["", "&durationMs=2000000"]) {
			assert.deepEqual(
				await (
					await get(`tmdbId=10&season=1&episode=1&ads=0${duration}`)
				).json(),
				{ markers: empty, ads: null },
			);
		}
		assert.deepEqual(await (await get(query)).json(), {
			markers: empty,
			ads: { eligible: true, scanComplete: false, segments: [] },
		});
		assert.equal(
			(await post({ kind: "ad", startMs: 100_000, endMs: 125_000 })).status,
			204,
		);
		assert.equal(
			(await post({ kind: "ad", startMs: 110_000, endMs: 120_000 })).status,
			204,
		);
		assert.equal(
			(await post({ kind: "ad", startMs: 100, endMs: 100 })).status,
			400,
		);
		assert.equal(
			(await post({ kind: "ad", tmdbId: 11, startMs: 100_000, endMs: 125_000 }))
				.status,
			403,
		);
		assert.equal((await post({ kind: "intro", timeMs: 50_000 })).status, 204);
		assert.equal(
			(await post({ kind: "outro", timeMs: 1_950_000 })).status,
			204,
		);
		assert.equal((await post({ kind: "intro", timeMs: 55_000 })).status, 204);
		assert.equal((await post({ kind: "outro", timeMs: 54_000 })).status, 409);
		statements = 0;
		assert.deepEqual(await (await get(query)).json(), {
			markers: { introEndMs: 55_000, outroStartMs: 1_950_000 },
			ads: {
				eligible: true,
				scanComplete: false,
				segments: [{ startMs: 100_000, endMs: 125_000 }],
			},
		});
		assert.equal(statements, 1);
		statements = 0;
		assert.deepEqual(await (await get(query + "&ads=0")).json(), {
			markers: { introEndMs: 55_000, outroStartMs: 1_950_000 },
			ads: null,
		});
		assert.equal(statements, 1);
		assert.equal(
			(await post({ kind: "intro", timeMs: 70_000, durationMs: 2_012_000 }))
				.status,
			204,
		);
		assert.equal(
			(await post({ kind: "intro", timeMs: 80_000, durationMs: undefined }))
				.status,
			400,
		);
		for (const [duration, markers] of [
			["", empty],
			["&durationMs=1989999", empty],
			["&durationMs=1990000", { introEndMs: 55_000, outroStartMs: 1_950_000 }],
			["&durationMs=2000000", { introEndMs: 55_000, outroStartMs: 1_950_000 }],
			["&durationMs=2007000", { introEndMs: 70_000, outroStartMs: null }],
			["&durationMs=2022001", empty],
		] as const) {
			assert.deepEqual(
				await (
					await get(`tmdbId=10&season=1&episode=2&ads=0${duration}`)
				).json(),
				{ markers, ads: null },
			);
		}
		assert.deepEqual(await (await get("tmdbId=10&season=1&episode=3")).json(), {
			markers: empty,
			ads: { eligible: true, scanComplete: false, segments: [] },
		});
		assert.deepEqual(await (await get("tmdbId=11&season=1&episode=2")).json(), {
			markers: empty,
			ads: { eligible: false, scanComplete: false, segments: [] },
		});
		assert.equal(
			(await post({ kind: "intro", startMs: 10_000, endMs: 55_000 })).status,
			204,
		);
		assert.equal(
			(await post({ kind: "outro", startMs: 1_950_000, endMs: 2_000_000 }))
				.status,
			204,
		);
		assert.equal((await post({ kind: "intro", timeMs: 60_000 })).status, 204);
		assert.equal(
			(await post({ kind: "outro", timeMs: 1_960_000 })).status,
			204,
		);
		for (const fields of [
			{ kind: "intro", startMs: 55_000, endMs: 55_000 },
			{ kind: "intro", startMs: 10_000 },
			{ kind: "intro", startMs: 0, endMs: 55_000, timeMs: 55_000 },
			{ kind: "outro", startMs: 1_950_000, endMs: 28_800_001 },
			{ kind: "outro", startMs: 1_950_000, endMs: 2_000_001 },
			{ kind: "outro", timeMs: 2_000_000 },
			{ kind: "intro", timeMs: 55_000, durationMs: null },
		]) {
			assert.equal((await post(fields)).status, 400);
		}
		assert.equal(
			(await post({ kind: "outro", startMs: 50_000, endMs: 90_000 })).status,
			409,
		);
		const ranges = {
			introStartMs: 10_000,
			introEndMs: 55_000,
			outroStartMs: 1_950_000,
			outroEndMs: 2_000_000,
		};
		assert.deepEqual(await (await get(`${query}&ranges=1`)).json(), {
			markers: ranges,
			ads: {
				eligible: true,
				scanComplete: false,
				segments: [{ startMs: 100_000, endMs: 125_000 }],
			},
		});
		assert.deepEqual(await (await get(`${query}&ranges=1&ads=0`)).json(), {
			markers: ranges,
			ads: null,
		});
		assert.deepEqual(await (await get(`${query}&ads=0`)).json(), {
			markers: empty,
			ads: null,
		});
		assert.equal(
			(await post({ kind: "intro", startMs: 0, endMs: 55_000 })).status,
			204,
		);
		assert.deepEqual(await (await get(query)).json(), {
			markers: { introEndMs: 55_000, outroStartMs: null },
			ads: {
				eligible: true,
				scanComplete: false,
				segments: [{ startMs: 100_000, endMs: 125_000 }],
			},
		});
		// Legacy reports stay stored, but only known, matching durations can be reused.
		assert.deepEqual(
			await getAdSegments("tmdbId=10&season=1&episode=1&durationMs=2000000"),
			[],
		);
		assert.deepEqual(await getAdSegments("tmdbId=10&season=1&episode=2"), []);
		const longAd = [{ startMs: 100_000, endMs: 125_000 }];
		for (const duration of [
			1_995_000, 1_999_000, 2_000_000, 2_001_000, 2_005_000,
		]) {
			assert.deepEqual(
				await getAdSegments(
					`tmdbId=10&season=1&episode=2&durationMs=${duration}`,
				),
				longAd,
			);
		}
		for (const duration of [1_994_999, 2_005_001, 1_977_000]) {
			assert.deepEqual(
				await getAdSegments(
					`tmdbId=10&season=1&episode=2&durationMs=${duration}`,
				),
				[],
			);
		}
		assert.equal(
			(
				await post({
					kind: "ad",
					durationMs: 2_005_000,
					startMs: 110_000,
					endMs: 120_000,
				})
			).status,
			204,
		);
		assert.equal(
			sqlite
				.query(
					"SELECT count(*) AS n FROM screen_ad_segments WHERE tmdb_id = 10 AND episode = 2",
				)
				.get().n,
			1,
		);
		assert.equal(
			(
				await post({
					kind: "ad",
					durationMs: 1_977_000,
					startMs: 200_000,
					endMs: 225_000,
				})
			).status,
			204,
		);
		assert.deepEqual(
			await getAdSegments("tmdbId=10&season=1&episode=2&durationMs=1977000"),
			[{ startMs: 200_000, endMs: 225_000 }],
		);
		assert.deepEqual(await getAdSegments(query), longAd);
		assert.equal(
			(
				await post({
					kind: "ad",
					durationMs: undefined,
					startMs: 300_000,
					endMs: 325_000,
				})
			).status,
			400,
		);
		assert.deepEqual(await getAdSegments("tmdbId=10&season=1&episode=2"), []);
		for (const durationMs of [
			0,
			-1,
			124_999,
			28_800_001,
			1.5,
			null,
			"invalid",
		]) {
			assert.equal(
				(
					await post({
						kind: "ad",
						durationMs,
						startMs: 100_000,
						endMs: 125_000,
					})
				).status,
				400,
			);
		}
		for (const durationMs of ["0", "-1", "NaN", "1.5", "28800001"]) {
			assert.equal(
				(
					await get(
						`${query.replace("&durationMs=2000000", "")}&durationMs=${durationMs}`,
					)
				).status,
				400,
			);
		}

		for (const [episode, startMs, endMs] of [
			[5, 0, 240_000],
			[6, 500_000, 500_100],
			[7, 1_900_000, 2_000_000],
		]) {
			assert.equal(
				(await post({ kind: "ad", episode, startMs, endMs })).status,
				204,
			);
			for (const duration of [1_995_000, 2_000_000, 2_005_000]) {
				assert.deepEqual(
					await getAdSegments(
						`tmdbId=10&season=1&episode=${episode}&durationMs=${duration}`,
					),
					[{ startMs, endMs }],
				);
			}
			assert.deepEqual(
				await getAdSegments(
					`tmdbId=10&season=1&episode=${episode}&durationMs=2005001`,
				),
				[],
			);
		}

		const repeatedAd = { startMs: 700_000, endMs: 800_000 };
		for (const durationMs of [2_000_000, 2_005_000, 2_000_000]) {
			assert.equal(
				(await post({ kind: "ad", episode: 5, durationMs, ...repeatedAd }))
					.status,
				204,
			);
		}
		const expectedAds = [{ startMs: 0, endMs: 240_000 }, repeatedAd];
		for (const durationMs of [1_995_000, 2_000_000, 2_005_000]) {
			assert.deepEqual(
				await getAdSegments(
					`tmdbId=10&season=1&episode=5&durationMs=${durationMs}`,
				),
				expectedAds,
			);
		}
		assert.equal(
			sqlite
				.query(
					"SELECT count(*) AS n FROM screen_ad_segments WHERE tmdb_id = 10 AND episode = 5",
				)
				.get().n,
			2,
		);

		// Match the closest duration when two tolerances overlap.
		assert.equal(
			(
				await post({
					kind: "ad",
					episode: 4,
					durationMs: 2_000_000,
					startMs: 100_000,
					endMs: 125_000,
				})
			).status,
			204,
		);
		assert.equal(
			(
				await post({
					kind: "ad",
					episode: 4,
					durationMs: 2_007_500,
					startMs: 200_000,
					endMs: 225_000,
				})
			).status,
			204,
		);
		assert.deepEqual(
			await getAdSegments("tmdbId=10&season=1&episode=4&durationMs=2004500"),
			[{ startMs: 200_000, endMs: 225_000 }],
		);
		// A catalog refresh follows the same matching policy as a cached lookup.
		sqlite.exec(
			"INSERT INTO screen_ad_segments VALUES (13, 1, 1, 100000, 125000, 2000000), (13, 1, 1, 200000, 225000, 2000000)",
		);
		assert.deepEqual(
			await getAdSegments("tmdbId=13&season=1&episode=1&durationMs=2000500"),
			[...longAd, { startMs: 200_000, endMs: 225_000 }],
		);
		sqlite.exec("DELETE FROM screen_ad_series WHERE tmdb_id = 13");
		assert.deepEqual(
			await getAdSegments("tmdbId=13&season=1&episode=1&durationMs=1977000"),
			[],
		);

		// Positive reports never imply completion, and a shorter report cannot replace a fuller set.
		const threeAds = [
			{ startMs: 100_000, endMs: 125_000 },
			{ startMs: 200_000, endMs: 225_000 },
			{ startMs: 300_000, endMs: 325_000 },
		];
		for (const [episode, reports] of [
			[81, [threeAds[0], ...threeAds]],
			[82, [...threeAds, threeAds[0]]],
		] as const) {
			const q = `tmdbId=10&season=1&episode=${episode}&durationMs=2000000`;
			for (const ad of reports)
				assert.equal((await post({ kind: "ad", episode, ...ad })).status, 204);
			assert.deepEqual(await getAdState(q), {
				eligible: true,
				scanComplete: false,
				segments: threeAds,
			});
			for (const durationMs of [2_001_000, 2_000_000])
				assert.equal(
					(await post({ kind: "ad_scan_complete", episode, durationMs }))
						.status,
					204,
				);
			assert.deepEqual(await getAdState(q), {
				eligible: true,
				scanComplete: true,
				segments: threeAds,
			});
			assert.equal(
				(await post({ kind: "ad", episode, ...threeAds[0] })).status,
				204,
			);
			assert.deepEqual(await getAdState(q), {
				eligible: true,
				scanComplete: true,
				segments: threeAds,
			});
			for (const runtime of [1_995_000, 2_005_000])
				assert.equal(
					(await getAdState(q.replace("2000000", String(runtime))))
						.scanComplete,
					true,
				);
			for (const runtime of [1_994_999, 2_005_001])
				assert.deepEqual(
					await getAdState(q.replace("2000000", String(runtime))),
					{ eligible: true, scanComplete: false, segments: [] },
				);
		}
		// Completion from a less comprehensive scan never freezes its advertisement list.
		assert.equal(
			(await post({ kind: "ad", episode: 84, ...threeAds[0] })).status,
			204,
		);
		assert.equal(
			(await post({ kind: "ad_scan_complete", episode: 84 })).status,
			204,
		);
		for (const ad of threeAds)
			assert.equal(
				(await post({ kind: "ad", episode: 84, ...ad })).status,
				204,
			);
		assert.equal(
			(await post({ kind: "ad_scan_complete", episode: 84 })).status,
			204,
		);
		assert.deepEqual(
			await getAdState("tmdbId=10&season=1&episode=84&durationMs=2000000"),
			{ eligible: true, scanComplete: true, segments: threeAds },
		);

		// A completed scan with no matches is versioned, not a global no-ad verdict.
		assert.equal(
			(await post({ kind: "ad_scan_complete", episode: 83 })).status,
			204,
		);
		assert.deepEqual(
			await getAdState("tmdbId=10&season=1&episode=83&durationMs=2000000"),
			{ eligible: true, scanComplete: true, segments: [] },
		);
		assert.equal(
			(
				await post({
					kind: "ad",
					episode: 83,
					durationMs: 2_001_000,
					...threeAds[0],
				})
			).status,
			204,
		);
		assert.deepEqual(
			await getAdState("tmdbId=10&season=1&episode=83&durationMs=2001000"),
			{ eligible: true, scanComplete: true, segments: [threeAds[0]] },
		);
		// A nearer incomplete version must not inherit a neighbouring version's completion.
		assert.equal(
			(
				await post({
					kind: "ad",
					episode: 83,
					durationMs: 2_007_500,
					...threeAds[1],
				})
			).status,
			204,
		);
		assert.deepEqual(
			await getAdState("tmdbId=10&season=1&episode=83&durationMs=2004500"),
			{ eligible: true, scanComplete: false, segments: [threeAds[1]] },
		);
		sqlite.exec("DELETE FROM screen_ad_series WHERE tmdb_id = 13");
		assert.equal(
			(await post({ kind: "ad_scan_complete", tmdbId: 13, episode: 2 })).status,
			204,
		);
		sqlite.exec("DELETE FROM screen_ad_series WHERE tmdb_id = 13");
		assert.equal(
			(await getAdState("tmdbId=13&season=1&episode=2&durationMs=2000000"))
				.scanComplete,
			true,
		);
		for (const durationMs of [
			undefined,
			null,
			0,
			-1,
			1.5,
			28_800_001,
			"invalid",
		])
			assert.equal(
				(await post({ kind: "ad_scan_complete", durationMs })).status,
				400,
			);
		assert.equal(
			(await post({ kind: "ad_scan_complete", tmdbId: 11 })).status,
			403,
		);

		assert.equal((await post({ kind: "no_ads" })).status, 400);
		sqlite.exec(
			"INSERT INTO screen_ad_free_episodes VALUES (10, 1, 2), (12, 1, 1)",
		);
		statements = 0;
		const confirmedNoAds = {
			confirmedNoAds: true,
			eligible: false,
			scanComplete: true,
			segments: [],
		};
		assert.deepEqual(await (await get(`${query}&ranges=1`)).json(), {
			markers: { ...ranges, introStartMs: 0 },
			ads: confirmedNoAds,
		});
		assert.deepEqual(await (await get("tmdbId=12&season=1&episode=1")).json(), {
			markers: empty,
			ads: confirmedNoAds,
		});
		assert.equal(statements, 2);
		for (const other of [
			"tmdbId=10&season=1&episode=3",
			"tmdbId=10&season=2&episode=2",
		]) {
			assert.deepEqual(await (await get(other)).json(), {
				markers: empty,
				ads: { eligible: true, scanComplete: false, segments: [] },
			});
		}
		sqlite.exec(
			"DELETE FROM screen_ad_free_episodes WHERE tmdb_id = 10 AND season = 1 AND episode = 2",
		);
		assert.deepEqual(await (await get(query)).json(), {
			markers: { introEndMs: 55_000, outroStartMs: null },
			ads: {
				eligible: true,
				scanComplete: false,
				segments: [{ startMs: 100_000, endMs: 125_000 }],
			},
		});
		assert.equal((await app.request(adminURL, undefined, env)).status, 401);
		const adminPage = await admin();
		assert.equal(adminPage.status, 200);
		assert.match(await adminPage.text(), /播放标记/);
		const series = {
			scope: "series",
			adMode: "none",
			introStart: "00:30",
			introEnd: "1:00",
			outroStart: "30:00",
			outroEnd: "30:50",
		};
		assert.equal((await save(series, "")).status, 401);
		assert.equal(
			(await save(series, ownerToken, "https://example.com")).status,
			403,
		);
		assert.equal((await save({ ...series, outroStart: "00:20" })).status, 400);
		assert.equal((await save(series)).status, 200);
		const defaults = {
			introStartMs: 30_000,
			introEndMs: 60_000,
			outroStartMs: 1_800_000,
			outroEndMs: 1_850_000,
		};
		assert.deepEqual(await (await get(`${query}&ranges=1`)).json(), {
			markers: defaults,
			ads: confirmedNoAds,
		});
		assert.deepEqual(
			await (await get("tmdbId=10&season=2&episode=1&ranges=1&ads=0")).json(),
			{ markers: defaults, ads: null },
		);
		assert.deepEqual(await (await get(`${query}&ads=0`)).json(), {
			markers: empty,
			ads: null,
		});
		const override = {
			scope: "episode",
			adMode: "range",
			adStart: "02:30.25",
			adEnd: "02:42",
			introStart: "0",
			introEnd: "24",
		};
		const shortAd = await save({ ...override, adEnd: "02:34" });
		assert.equal(shortAd.status, 200);
		const longAdOverride = await save({ ...override, adEnd: "12:34" });
		assert.equal(longAdOverride.status, 200);

		assert.equal(
			(
				await save({
					...override,
					adStart: "０２：３０．２５",
					introStart: "0:0",
				})
			).status,
			200,
		);
		assert.deepEqual(await (await get(`${query}&ranges=1`)).json(), {
			markers: { ...defaults, introStartMs: 0, introEndMs: 24_000 },
			ads: {
				eligible: true,
				scanComplete: false,
				segments: [{ startMs: 150_250, endMs: 162_000 }],
			},
		});
		const season = {
			scope: "season",
			season: "1",
			introStart: "5",
			introEnd: "35",
			outroStart: "29:00",
			outroEnd: "29:40",
			adMode: "range",
			adStart: "2:00",
			adEnd: "2:20",
		};
		const seasonPage = "?tmdbId=10&season=1&scope=season";
		const seasonSibling = "tmdbId=10&season=1&episode=3&ranges=1";
		const seasonMarkers = {
			introStartMs: 5_000,
			introEndMs: 35_000,
			outroStartMs: 1_740_000,
			outroEndMs: 1_780_000,
		};
		assert.equal((await save({ ...season, season: "-1" })).status, 400);
		assert.equal((await save(season)).status, 200);
		assert.match(await (await admin(seasonPage)).text(), /整季默认/);
		assert.deepEqual(await (await get(seasonSibling)).json(), {
			markers: seasonMarkers,
			ads: {
				eligible: true,
				scanComplete: false,
				segments: [{ startMs: 120_000, endMs: 140_000 }],
			},
		});
		assert.deepEqual(
			await (await get("tmdbId=10&season=2&episode=1&ranges=1")).json(),
			{ markers: defaults, ads: confirmedNoAds },
		);
		assert.equal((await save({ ...season, adMode: "none" })).status, 200);
		assert.deepEqual(await (await get(seasonSibling)).json(), {
			markers: seasonMarkers,
			ads: confirmedNoAds,
		});
		assert.deepEqual(await (await get(`${query}&ranges=1`)).json(), {
			markers: { ...seasonMarkers, introStartMs: 0, introEndMs: 24_000 },
			ads: {
				eligible: true,
				scanComplete: false,
				segments: [{ startMs: 150_250, endMs: 162_000 }],
			},
		});
		assert.equal(
			(await save({ scope: "season", adMode: "inherit" })).status,
			200,
		);
		assert.deepEqual(await (await get(`${seasonSibling}&ads=0`)).json(), {
			markers: defaults,
			ads: null,
		});
		assert.equal(
			(
				await save({
					...series,
					adMode: "range",
					adStart: "02:00",
					adEnd: "02:20",
				})
			).status,
			200,
		);
		assert.deepEqual(
			await (await get("tmdbId=10&season=2&episode=1&ranges=1")).json(),
			{
				markers: defaults,
				ads: {
					eligible: true,
					scanComplete: false,
					segments: [{ startMs: 120_000, endMs: 140_000 }],
				},
			},
		);
		assert.deepEqual(await (await get(`${query}&ranges=1`)).json(), {
			markers: { ...defaults, introStartMs: 0, introEndMs: 24_000 },
			ads: {
				eligible: true,
				scanComplete: false,
				segments: [{ startMs: 150_250, endMs: 162_000 }],
			},
		});
		assert.equal(
			(await save({ scope: "episode", adMode: "none" })).status,
			200,
		);
		assert.deepEqual(await (await get(`${query}&ranges=1`)).json(), {
			markers: defaults,
			ads: confirmedNoAds,
		});
		assert.equal(
			(await save({ scope: "series", adMode: "inherit" })).status,
			200,
		);
		assert.deepEqual(await (await get(query)).json(), {
			markers: { introEndMs: 55_000, outroStartMs: null },
			ads: confirmedNoAds,
		});
		assert.equal(
			(await save({ scope: "episode", adMode: "inherit" })).status,
			200,
		);
		assert.deepEqual(await (await get(query)).json(), {
			markers: { introEndMs: 55_000, outroStartMs: null },
			ads: {
				eligible: true,
				scanComplete: false,
				segments: [{ startMs: 100_000, endMs: 125_000 }],
			},
		});
		assert.equal(
			(await admin("", await token(owner, "different-audience"))).status,
			401,
		);
		assert.equal(
			(await admin("", await token(owner, audience, 100))).status,
			401,
		);
		const parts = ownerToken.split(".");
		assert.equal((await admin("", `${parts[0]}.${parts[1]}.AAAA`)).status, 401);
		assert.equal(
			(
				await app.request(
					adminURL,
					{ headers: { cookie: "blocks_admin=timing-test" } },
					env,
				)
			).status,
			401,
		);
		assert.equal((await admin("", editorToken)).status, 403);
		assert.equal((await save(series, editorToken)).status, 403);
		assert.match(
			(await memberChange("invite", editor.toUpperCase())).headers.get(
				"location",
			) ?? "",
			/status=invite$/,
		);
		assert.match(await (await admin("/members")).text(), /待加入/);
		assert.equal((await admin("", editorToken)).status, 200);
		assert.match(
			(await admin("?q=94", editorToken)).headers.get("location") ?? "",
			/scope=episode#timing-editor$/,
		);
		const firstEpisode = await (
			await admin("?tmdbId=94&scope=episode", editorToken)
		).text();
		assert.match(firstEpisode, /第 0 季 · 第 2 集/);
		assert.match(firstEpisode, /保存本集设置/);
		assert.match(firstEpisode, /episode=4#timing-editor/);
		assert.match(firstEpisode, /href="#timing-ad"/);
		const missingEpisodes = await (
			await admin("?tmdbId=94&season=5&scope=episode")
		).text();
		assert.match(missingEpisodes, /选择要编辑的分集/);
		assert.doesNotMatch(missingEpisodes, /保存整剧设置/);
		assert.match(await (await admin("/members")).text(), /已加入/);
		assert.equal((await admin("/members", editorToken)).status, 403);
		assert.equal(
			(await memberChange("invite", "other@example.com", editorToken)).status,
			403,
		);
		const seriesEditor = await (await admin("?tmdbId=10", editorToken)).text();
		assert.match(seriesEditor, /<fieldset class="editor-fields">/);
		assert.match(seriesEditor, /保存整剧设置/);
		sqlite.exec(`INSERT OR REPLACE INTO episode_intro_outro (tmdb_id, season, episode, intro_end_ms)
			VALUES (10, 1, 2, 80000)`);
		const episodeEditor = await (
			await admin("?tmdbId=10&season=1&episode=2", editorToken)
		).text();
		assert.match(episodeEditor, /已收集 · 33:20/);
		assert.match(episodeEditor, /已收集 · 33:32/);
		assert.match(episodeEditor, /已收集 · 时长未知/);
		const seasonEditor = await (
			await admin("?tmdbId=94&season=0&scope=season", editorToken)
		).text();
		assert.match(seasonEditor, /<fieldset class="editor-fields">/);
		assert.match(seasonEditor, /保存整季设置/);
		assert.match(seasonEditor, /name="scope" value="season"/);
		assert.doesNotMatch(seasonEditor, /name="scope" value="episode"/);
		assert.equal((await save(series, editorToken)).status, 200);
		assert.equal((await save(season, editorToken)).status, 200);
		assert.deepEqual(await (await get(seasonSibling)).json(), {
			markers: seasonMarkers,
			ads: {
				eligible: true,
				scanComplete: false,
				segments: [{ startMs: 120_000, endMs: 140_000 }],
			},
		});
		assert.deepEqual(
			await (await get("tmdbId=10&season=2&episode=1&ranges=1")).json(),
			{ markers: defaults, ads: confirmedNoAds },
		);
		assert.equal(
			(
				await save(
					{
						...override,
						tmdbId: "11",
						season: "2",
						episode: "6",
						outroStart: "20:00",
						outroEnd: "21:00",
					},
					editorToken,
				)
			).status,
			200,
		);
		assert.deepEqual(
			await (
				await get("tmdbId=11&season=2&episode=6&ranges=1&durationMs=2000000")
			).json(),
			{
				markers: {
					introStartMs: 0,
					introEndMs: 24000,
					outroStartMs: 1200000,
					outroEndMs: 1260000,
				},
				ads: {
					eligible: true,
					scanComplete: false,
					segments: [{ startMs: 150250, endMs: 162000 }],
				},
			},
		);
		const otherCut = (await (
			await get("tmdbId=11&season=2&episode=6&ranges=1&durationMs=2600000")
		).json()) as { markers: { outroStartMs: number | null } };
		assert.equal(otherCut.markers.outroStartMs, null);
		assert.equal(
			(await save({ ...override, duration: "" }, editorToken)).status,
			400,
		);
		assert.match(
			(await memberChange("remove", editor)).headers.get("location") ?? "",
			/status=remove$/,
		);
		assert.equal((await admin("", editorToken)).status, 403);
		for (const fields of [series, season, override]) {
			assert.equal((await save(fields, editorToken)).status, 403);
		}
		const audit = sqlite
			.query(
				"SELECT actor_email, action, subject FROM timing_admin_audit ORDER BY id DESC LIMIT 5",
			)
			.values();
		assert.deepEqual(audit, [
			[owner, "remove", editor],
			[editor, "save", "TMDB 11 · S2 E6"],
			[editor, "save", "TMDB 10 · 第 1 季"],
			[editor, "save", "TMDB 10 · 整剧"],
			[owner, "invite", editor],
		]);
	} finally {
		globalThis.fetch = originalFetch;
		sqlite.close();
	}
});

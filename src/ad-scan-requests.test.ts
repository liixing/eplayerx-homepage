import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { adRequestsApp, adRequestsWorkerApp } from "./ad-scan-requests.js";

test("ad requests deduplicate by series, keep legacy IDs and finish once", async () => {
	const { Database } = require("bun:sqlite");
	const sqlite = new Database(":memory:");
	const directory = new URL("../migrations/", import.meta.url);
	for (const file of readdirSync(directory).sort()) {
		if (file >= "0012" && file <= "0022_ad_scan_airing.sql")
			sqlite.exec(readFileSync(new URL(file, directory), "utf8"));
	}
	const legacyID = "10000000-0000-0000-0000-000000000001";
	const legacyAlias = "10000000-0000-0000-0000-000000000002";
	sqlite.exec(`INSERT INTO ad_scan_requests (id, tmdb_id, title, position, status)
		VALUES ('${legacyID}', 777, 'Legacy Series', 'opening', 'completed'),
		       ('${legacyAlias}', 777, 'Legacy Series', 'midroll', 'completed');`);
	sqlite.exec(
		readFileSync(new URL("0023_ad_scan_by_series.sql", directory), "utf8"),
	);
	sqlite.exec(
		readFileSync(new URL("0025_episode_rule_duration.sql", directory), "utf8"),
	);
	sqlite.exec(
		"UPDATE ad_scan_requests SET next_check_at = 4102444800 WHERE tmdb_id = 777",
	);
	const db = {
		prepare(sql: string) {
			const query = sqlite.query(sql);
			const bound = (...values: unknown[]) => ({
				first: (column?: string) => {
					const row = query.get(...values);
					return (column ? row?.[column] : row) ?? null;
				},
				all: () => ({ results: query.all(...values) }),
				run: () => ({ meta: { changes: query.run(...values).changes } }),
			});
			return { ...bound(), bind: bound };
		},
	} as unknown as D1Database;
	const env = {
		DB: db,
		EPISODE_TIMING_RATE_LIMITER: { limit: async () => ({ success: true }) },
	};
	const oldFetch = globalThis.fetch;
	const oldPassword = process.env.BLOCKS_ADMIN_PASSWORD;
	let catalogCalls = 0;
	globalThis.fetch = Object.assign(async () => {
		catalogCalls++;
		return Response.json({
			id: 231620,
			name: "现在就出发",
			status: "Returning Series",
			in_production: true,
			poster_path: "/poster.jpg",
			first_air_date: "2023-08-13",
			last_episode_to_air: { season_number: 4, episode_number: 7 },
			next_episode_to_air: {
				season_number: 4,
				episode_number: 8,
				air_date: "2027-01-01",
			},
		});
	}, oldFetch);
	process.env.BLOCKS_ADMIN_PASSWORD = "ad-request-test";
	const headers = {
		"Content-Type": "application/json",
		"CF-Connecting-IP": "192.0.2.1",
	};
	const submit = (body: unknown) =>
		adRequestsApp.request(
			"/",
			{ method: "POST", headers, body: JSON.stringify(body) },
			env,
		);
	const worker = (path: string, body?: unknown) =>
		adRequestsWorkerApp.request(
			path,
			{
				method: body === undefined ? "GET" : "POST",
				headers: { ...headers, Authorization: "Bearer ad-request-test" },
				...(body === undefined ? {} : { body: JSON.stringify(body) }),
			},
			env,
		);
	try {
		assert.equal((await submit({ tmdbId: 0 })).status, 400);
		assert.equal(catalogCalls, 0);
		const first = await submit({ tmdbId: 231620 });
		assert.equal(first.status, 201);
		const record = (await first.json()) as {
			id: string;
			status: string;
			posterPath: string;
			year: string;
		};
		assert.equal(record.status, "processing");
		assert.equal(record.posterPath, "/poster.jpg");
		assert.equal(record.year, "2023");
		const repeat = (await (await submit({ tmdbId: 231620 })).json()) as {
			id: string;
		};
		assert.equal(repeat.id, record.id);
		assert.equal(catalogCalls, 1);

		const read = async (ids: string) => {
			const response = await adRequestsApp.request(
				`/?ids=${ids}`,
				{ headers },
				env,
			);
			assert.equal(response.status, 200);
			return (
				(await response.json()) as {
					requests: { id: string; status: string }[];
				}
			).requests;
		};
		assert.deepEqual(
			(await read(record.id)).map((item) => item.id),
			[record.id],
		);
		assert.deepEqual(
			(await read(legacyAlias)).map((item) => item.id),
			[legacyID],
		);
		assert.deepEqual(
			(await read(`${legacyAlias},${legacyID}`)).map((item) => item.status),
			["processing"],
		);
		assert.equal(
			(await adRequestsApp.request("/?ids=bad", { headers }, env)).status,
			400,
		);
		assert.equal(
			(await adRequestsWorkerApp.request("/claim", { method: "POST" }, env))
				.status,
			401,
		);
		assert.equal((await adRequestsWorkerApp.request("/", {}, env)).status, 401);
		const list = (await (await worker("/")).json()) as {
			requests: { id: string }[];
		};
		assert.deepEqual(
			new Set(list.requests.map((item) => item.id)),
			new Set([record.id, legacyID]),
		);
		assert.equal((await worker("/?page=0")).status, 400);

		const claim = async () =>
			(
				(await (await worker("/claim", {})).json()) as {
					request: { id: string; leaseToken: string } | null;
				}
			).request;
		const lease = await claim();
		assert.ok(lease);
		assert.equal(lease.id, record.id);
		assert.equal(await claim(), null);
		assert.equal(
			(await worker(`/${lease.id}/heartbeat`, { leaseToken: lease.leaseToken }))
				.status,
			200,
		);
		assert.equal(
			(
				await worker(`/${lease.id}/heartbeat`, {
					leaseToken: crypto.randomUUID(),
				})
			).status,
			409,
		);
		const update = {
			status: "completed",
			ongoing: true,
			lastSeason: 4,
			lastEpisode: 6,
			checkAfterSeconds: 3600,
			leaseToken: lease.leaseToken,
		};
		assert.equal(
			(
				await worker(`/${lease.id}`, {
					...update,
					leaseToken: crypto.randomUUID(),
				})
			).status,
			409,
		);
		const waiting = (await (await worker(`/${lease.id}`, update)).json()) as {
			status: string;
		};
		assert.equal(waiting.status, "waiting_resource");
		const due = () =>
			sqlite
				.query("UPDATE ad_scan_requests SET next_check_at = 0 WHERE id = ?")
				.run(record.id);
		due();
		const retry = await claim();
		assert.ok(retry);
		const response = await worker(`/${retry.id}`, {
			...update,
			lastEpisode: 7,
			leaseToken: retry.leaseToken,
		});
		assert.equal(response.status, 200);
		const completed = (await response.json()) as {
			status: string;
			nextCheckAt: number | null;
		};
		assert.equal(completed.status, "completed");
		assert.equal(completed.nextCheckAt, null);
		assert.equal((await worker(`/${record.id}/data`)).status, 200);
		due();
		assert.equal(await claim(), null, "completed series stay out of the queue");
	} finally {
		globalThis.fetch = oldFetch;
		if (oldPassword === undefined) delete process.env.BLOCKS_ADMIN_PASSWORD;
		else process.env.BLOCKS_ADMIN_PASSWORD = oldPassword;
		sqlite.close();
	}
});

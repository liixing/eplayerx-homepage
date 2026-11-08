import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import {
	type AdScanCatalog,
	hasCoveredEpisode,
	lookupAdScanSeries,
} from "./ad-scan-catalog.js";
import { isAdminBearer } from "./blocks/admin.js";
import { getDb } from "./blocks/runtime.js";
import type { BlocksBindings } from "./blocks/types.js";
import { integer } from "./episode-timings.js";

type Bindings = BlocksBindings & {
	EPISODE_TIMING_RATE_LIMITER?: {
		limit(options: { key: string }): Promise<{ success: boolean }>;
	};
};
type RequestRow = {
	id: string;
	tmdbId: number;
	title: string;
	status: "processing" | "waiting_resource" | "completed";
	ongoing: number;
	lastSeason: number | null;
	lastEpisode: number | null;
	catalogJson: string | null;
	createdAt: number;
	updatedAt: number;
	nextCheckAt: number;
};
const columns = `id, tmdb_id AS tmdbId, title, status, ongoing,
	last_season AS lastSeason, last_episode AS lastEpisode, catalog_json AS catalogJson,
	created_at AS createdAt, updated_at AS updatedAt, next_check_at AS nextCheckAt`;
const catalogFor = (value: string | null): AdScanCatalog | null =>
	value ? JSON.parse(value) : null;
const payload = ({ catalogJson, ...row }: RequestRow) => {
	const catalog = catalogFor(catalogJson);
	return {
		...row,
		ongoing: row.ongoing === 1,
		catalog,
		posterPath: catalog?.posterPath ?? null,
		year: catalog?.year ?? null,
		nextCheckAt: row.status === "completed" ? null : row.nextCheckAt,
	};
};

export async function listAdScanRequests(db: D1Database, page: number) {
	const pageSize = 50;
	const { results } = await db
		.prepare(
			`SELECT ${columns} FROM ad_scan_requests ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
		)
		.bind(pageSize + 1, (page - 1) * pageSize)
		.all<RequestRow>();
	return {
		requests: results.slice(0, pageSize).map(payload),
		nextPage: results.length > pageSize ? page + 1 : null,
	};
}
export type AdScanRequestPage = Awaited<ReturnType<typeof listAdScanRequests>>;
export function adScanPageNumber(value: string | undefined) {
	return value === undefined ? 1 : integer(value, 1, 1000000);
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unavailable = () => ({ error: "Ad requests unavailable" });

export const adRequestsApp = new Hono<{ Bindings: Bindings }>();
adRequestsApp.use("*", async (c, next) => {
	c.header("Cache-Control", "no-store");
	const limiter = c.env?.EPISODE_TIMING_RATE_LIMITER;
	if (!limiter || !c.env.DB) return c.json(unavailable(), 503);
	const address = c.req.header("CF-Connecting-IP");
	if (!address) return c.json({ error: "Missing client address" }, 403);
	try {
		if (!(await limiter.limit({ key: `ad-requests:${address}` })).success)
			return c.json({ error: "Rate limit reached" }, 429, {
				"Retry-After": "60",
			});
	} catch {
		return c.json(unavailable(), 503);
	}
	await next();
});

adRequestsApp.get("/", async (c) => {
	const ids = [
		...new Set((c.req.query("ids") ?? "").split(",").filter(Boolean)),
	];
	if (!ids.length || ids.length > 50 || ids.some((id) => !uuid.test(id)))
		return c.json({ error: "Invalid request IDs" }, 400);
	try {
		const requested = ids.map(() => "(?)").join(",");
		const { results } = await getDb(c)
			.prepare(`WITH requested(id) AS (VALUES ${requested})
			SELECT ${columns} FROM ad_scan_requests WHERE id IN (
				SELECT coalesce(aliases.request_id, requested.id) FROM requested
				LEFT JOIN ad_scan_request_aliases AS aliases USING (id)
			) ORDER BY created_at DESC, id`)
			.bind(...ids)
			.all<RequestRow>();
		return c.json({ requests: results.map(payload) });
	} catch {
		return c.json(unavailable(), 503);
	}
});

adRequestsApp.post("/", bodyLimit({ maxSize: 1024 }), async (c) => {
	const input = await c.req.json().catch(() => null);
	const id = integer(input?.tmdbId, 1, 2_147_483_647);
	if (!id) return c.json({ error: "Invalid ad request" }, 400);
	try {
		const db = getDb(c);
		const existing = await db
			.prepare(`SELECT ${columns} FROM ad_scan_requests WHERE tmdb_id = ?`)
			.bind(id)
			.first<RequestRow>();
		if (existing) return c.json(payload(existing));
		const series = await lookupAdScanSeries(id);
		if (!series.found)
			return series.missing
				? c.json({ error: "Series not found" }, 404)
				: c.json(unavailable(), 503);
		const row = await db
			.prepare(`INSERT INTO ad_scan_requests (id, tmdb_id, title, ongoing, catalog_json)
			VALUES (?, ?, ?, ?, ?) ON CONFLICT (tmdb_id) DO UPDATE SET title = ad_scan_requests.title
			RETURNING ${columns}`)
			.bind(
				crypto.randomUUID(),
				id,
				series.title,
				Number(series.catalog.ongoing !== false),
				JSON.stringify(series.catalog),
			)
			.first<RequestRow>();
		if (!row) return c.json(unavailable(), 503);
		return c.json(payload(row), 201);
	} catch {
		return c.json(unavailable(), 503);
	}
});

// The local scanner uses the same authenticated script channel as existing admin tools.
export const adRequestsWorkerApp = new Hono<{ Bindings: Bindings }>();
adRequestsWorkerApp.use("*", async (c, next) => {
	c.header("Cache-Control", "no-store");
	if (!isAdminBearer(c)) return c.json({ error: "Unauthorized" }, 401);
	await next();
});
adRequestsWorkerApp.get("/", async (c) => {
	const page = adScanPageNumber(c.req.query("page"));
	if (page === undefined) return c.json({ error: "Invalid page" }, 400);
	try {
		return c.json(await listAdScanRequests(getDb(c), page));
	} catch {
		return c.json(unavailable(), 503);
	}
});
adRequestsWorkerApp.post("/claim", async (c) => {
	try {
		const db = getDb(c);
		const leaseToken = crypto.randomUUID();
		const row = await db
			.prepare(`UPDATE ad_scan_requests SET lease_token = ?, lease_until = unixepoch() + 900
			WHERE id = (SELECT id FROM ad_scan_requests
				WHERE next_check_at <= unixepoch() AND lease_until <= unixepoch()
				AND status <> 'completed'
				ORDER BY next_check_at, created_at, id LIMIT 1)
			RETURNING ${columns}`)
			.bind(leaseToken)
			.first<RequestRow>();
		if (!row) return c.json({ request: null });

		const series = await lookupAdScanSeries(row.tmdbId).catch(() => null);
		const catalog = series?.found ? series.catalog : null;
		const ongoing =
			catalog?.ongoing == null ? row.ongoing : Number(catalog.ongoing);
		const refreshed = await db
			.prepare(`UPDATE ad_scan_requests SET
			title = coalesce(?, title), catalog_json = coalesce(?, catalog_json), ongoing = ?,
			status = 'processing', updated_at = unixepoch()
			WHERE id = ? AND lease_token = ? AND lease_until > unixepoch()
			RETURNING ${columns}`)
			.bind(
				series?.found ? series.title : null,
				catalog ? JSON.stringify(catalog) : null,
				ongoing,
				row.id,
				leaseToken,
			)
			.first<RequestRow>();
		return c.json({
			request: refreshed ? { ...payload(refreshed), leaseToken } : null,
		});
	} catch {
		return c.json(unavailable(), 503);
	}
});
adRequestsWorkerApp.post(
	"/:id/heartbeat",
	bodyLimit({ maxSize: 256 }),
	async (c) => {
		const input = await c.req.json().catch(() => null);
		const id = c.req.param("id");
		if (!uuid.test(id) || !uuid.test(input?.leaseToken ?? ""))
			return c.json({ error: "Invalid lease" }, 400);
		try {
			const row = await getDb(c)
				.prepare(`UPDATE ad_scan_requests SET lease_until = unixepoch() + 900
            WHERE id = ? AND lease_token = ? AND lease_until > unixepoch() RETURNING id`)
				.bind(id, input.leaseToken)
				.first();
			return row
				? c.json({ ok: true })
				: c.json({ error: "Request lease expired" }, 409);
		} catch {
			return c.json(unavailable(), 503);
		}
	},
);
adRequestsWorkerApp.get("/:id/data", async (c) => {
	if (!uuid.test(c.req.param("id")))
		return c.json({ error: "Invalid request" }, 400);
	try {
		const db = getDb(c);
		const row = await db
			.prepare("SELECT tmdb_id FROM ad_scan_requests WHERE id = ?")
			.bind(c.req.param("id"))
			.first<{ tmdb_id: number }>();
		if (!row) return c.json({ error: "Request not found" }, 404);
		const [segments, rules, adFreeEpisodes] = await Promise.all([
			db
				.prepare(`SELECT season, episode, start_ms AS startMs, end_ms AS endMs, duration_ms AS durationMs
				FROM screen_ad_segments WHERE tmdb_id = ? ORDER BY season, episode, duration_ms, start_ms`)
				.bind(row.tmdb_id)
				.all(),
			db
				.prepare(`SELECT season, episode, ad_start_ms AS startMs, ad_end_ms AS endMs, no_ads AS noAds
				FROM playback_timing_rules WHERE tmdb_id = ? ORDER BY season, episode`)
				.bind(row.tmdb_id)
				.all(),
			db
				.prepare(`SELECT season, episode FROM screen_ad_free_episodes
				WHERE tmdb_id = ? ORDER BY season, episode`)
				.bind(row.tmdb_id)
				.all(),
		]);
		return c.json({
			segments: segments.results,
			rules: rules.results,
			adFreeEpisodes: adFreeEpisodes.results,
		});
	} catch {
		return c.json(unavailable(), 503);
	}
});
adRequestsWorkerApp.post("/:id", bodyLimit({ maxSize: 1024 }), async (c) => {
	const input = await c.req.json().catch(() => null);
	const id = c.req.param("id");
	const statuses = ["processing", "waiting_resource", "completed"];
	const delay = integer(input?.checkAfterSeconds, 60, 604800);
	const season =
		input?.lastSeason == null ? null : integer(input.lastSeason, 0, 1000);
	const episode =
		input?.lastEpisode == null ? null : integer(input.lastEpisode, 1, 100000);
	if (
		!uuid.test(id) ||
		!uuid.test(input?.leaseToken ?? "") ||
		!statuses.includes(input?.status) ||
		typeof input?.ongoing !== "boolean" ||
		delay === undefined ||
		season === undefined ||
		episode === undefined ||
		(season === null) !== (episode === null)
	)
		return c.json({ error: "Invalid request update" }, 400);
	try {
		const db = getDb(c);
		const current = await db
			.prepare(
				`SELECT ${columns} FROM ad_scan_requests WHERE id = ? AND lease_token = ? AND lease_until > unixepoch()`,
			)
			.bind(id, input.leaseToken)
			.first<RequestRow>();
		if (!current) return c.json({ error: "Request lease expired" }, 409);
		const catalog = catalogFor(current.catalogJson);
		const ongoing =
			catalog?.ongoing ??
			(current.catalogJson ? current.ongoing === 1 : input.ongoing);
		const keepProgress =
			season === null ||
			(episode !== null &&
				hasCoveredEpisode(current.lastSeason, current.lastEpisode, {
					season,
					episode,
					airDate: null,
				}));
		const lastSeason = keepProgress ? current.lastSeason : season;
		const lastEpisode = keepProgress ? current.lastEpisode : episode;
		const behind =
			catalog?.lastAired &&
			!hasCoveredEpisode(lastSeason, lastEpisode, catalog.lastAired);
		const status =
			input.status === "completed" && behind
				? "waiting_resource"
				: input.status;
		const row = await db
			.prepare(`UPDATE ad_scan_requests SET status = ?, ongoing = ?,
			last_season = ?, last_episode = ?, next_check_at = unixepoch() + ?, updated_at = unixepoch(),
			lease_token = NULL, lease_until = 0 WHERE id = ? AND lease_token = ? AND lease_until > unixepoch()
			RETURNING ${columns}`)
			.bind(
				status,
				Number(ongoing),
				lastSeason,
				lastEpisode,
				delay,
				id,
				input.leaseToken,
			)
			.first<RequestRow>();
		return row
			? c.json(payload(row))
			: c.json({ error: "Request lease expired" }, 409);
	} catch {
		return c.json(unavailable(), 503);
	}
});

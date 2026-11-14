import { type Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { tmdb } from "./tmdb/index.js";

type Env = {
	Bindings: {
		DB?: D1Database;
		EPISODE_TIMING_RATE_LIMITER?: {
			limit(options: { key: string }): Promise<{ success: boolean }>;
		};
	};
};

type Markers = {
	introStartMs: number | null;
	introEndMs: number | null;
	outroStartMs: number | null;
	outroEndMs: number | null;
};
type TimingRow = Markers & {
	introRank: number;
	outroRank: number;
	eligible: number | null;
	confirmedNoAds: number;
	scanComplete: number;
	manualAdStartMs: number | null;
	manualAdEndMs: number | null;
	startMs: number | null;
	endMs: number | null;
};

const app = new Hono<Env>();
const scope = "tmdb_id = ? AND season = ? AND episode = ?";
const maxTime = 28_800_000;
const durationTolerance = 5000;
const markerDurationTolerance = 10_000; // Same as TODB's runtime match tolerance.
const markerColumns = `
	CASE WHEN e.intro_end_ms IS NOT NULL THEN e.intro_start_ms
		WHEN t.intro_end_ms IS NOT NULL THEN t.intro_start_ms
		WHEN d.intro_end_ms IS NOT NULL THEN d.intro_start_ms ELSE m.intro_start_ms END AS introStartMs,
	coalesce(e.intro_end_ms, t.intro_end_ms, d.intro_end_ms, m.intro_end_ms) AS introEndMs,
	coalesce(e.outro_start_ms, t.outro_start_ms, d.outro_start_ms, m.outro_start_ms) AS outroStartMs,
	CASE WHEN e.outro_start_ms IS NOT NULL THEN e.outro_end_ms
		WHEN t.outro_start_ms IS NOT NULL THEN t.outro_end_ms
		WHEN d.outro_start_ms IS NOT NULL THEN d.outro_end_ms ELSE m.outro_end_ms END AS outroEndMs,
	CASE WHEN e.intro_end_ms IS NOT NULL THEN 3 WHEN t.intro_end_ms IS NOT NULL THEN 2
		WHEN d.intro_end_ms IS NOT NULL THEN 1 ELSE 0 END AS introRank,
	CASE WHEN e.outro_start_ms IS NOT NULL THEN 3 WHEN t.outro_start_ms IS NOT NULL THEN 2
		WHEN d.outro_start_ms IS NOT NULL THEN 1 ELSE 0 END AS outroRank`;
// Pick one runtime version for both its advertisements and completion status.
const adVersionCTE = `matched_ad_version AS (
	SELECT duration_ms FROM (
		SELECT a.duration_ms FROM screen_ad_segments a JOIN requested r USING (tmdb_id, season, episode)
		WHERE r.duration_ms > 0 AND a.duration_ms > 0
			AND a.duration_ms BETWEEN r.duration_ms - ${durationTolerance} AND r.duration_ms + ${durationTolerance}
		UNION
		SELECT a.duration_ms FROM screen_ad_scan_completions a JOIN requested r USING (tmdb_id, season, episode)
		WHERE r.duration_ms > 0
			AND a.duration_ms BETWEEN r.duration_ms - ${durationTolerance} AND r.duration_ms + ${durationTolerance}
	) ORDER BY abs(duration_ms - (SELECT duration_ms FROM requested)), duration_ms LIMIT 1
)`;
const markerSelect = `WITH requested(tmdb_id, season, episode, duration_ms) AS (VALUES (?, ?, ?, ?)),
	matched_markers AS (
		SELECT m.* FROM episode_intro_outro_versions m JOIN requested r USING (tmdb_id, season, episode)
		WHERE r.duration_ms > 0
			AND m.duration_ms BETWEEN r.duration_ms - ${markerDurationTolerance} AND r.duration_ms + ${markerDurationTolerance}
		ORDER BY abs(m.duration_ms - r.duration_ms), m.duration_ms LIMIT 1
	),
	matched_rule AS (
		SELECT p.* FROM playback_timing_rules p JOIN requested r USING (tmdb_id, season, episode)
		WHERE p.duration_ms = 0 OR (r.duration_ms > 0
			AND p.duration_ms BETWEEN r.duration_ms - ${markerDurationTolerance} AND r.duration_ms + ${markerDurationTolerance})
		ORDER BY p.duration_ms = 0, abs(p.duration_ms - r.duration_ms) LIMIT 1
	), ${adVersionCTE}
	SELECT ${markerColumns}`;
const markerSource = `FROM requested r
	LEFT JOIN matched_markers m USING (tmdb_id, season, episode)
	LEFT JOIN matched_rule e USING (tmdb_id, season, episode)
	LEFT JOIN playback_timing_rules t ON t.tmdb_id = r.tmdb_id AND t.season = r.season AND t.episode = 0
	LEFT JOIN playback_timing_rules d ON d.tmdb_id = r.tmdb_id AND d.season = -1 AND d.episode = 0`;

function markerPayload(
	row: (Markers & Pick<TimingRow, "introRank" | "outroRank">) | null,
	supportsRanges: boolean,
) {
	const markers = {
		introStartMs: row?.introStartMs ?? null,
		introEndMs: row?.introEndMs ?? null,
		outroStartMs: row?.outroStartMs ?? null,
		outroEndMs: row?.outroEndMs ?? null,
	};
	if (
		row &&
		markers.introEndMs !== null &&
		markers.outroStartMs !== null &&
		markers.introEndMs >= markers.outroStartMs
	) {
		if (row.introRank >= row.outroRank) {
			markers.outroStartMs = markers.outroEndMs = null;
		} else {
			markers.introStartMs = markers.introEndMs = null;
		}
	}
	if (supportsRanges) return markers;
	// Older players would widen these ranges to the start or end of the video.
	return {
		introEndMs: markers.introStartMs ? null : markers.introEndMs,
		outroStartMs: markers.outroEndMs === null ? markers.outroStartMs : null,
	};
}

export function integer(
	value: unknown,
	min: number,
	max: number,
): number | undefined {
	if (typeof value === "string" && /^\d+$/.test(value)) value = Number(value);
	if (
		typeof value === "number" &&
		Number.isSafeInteger(value) &&
		value >= min &&
		value <= max
	)
		return value;
}

export function parseEpisode(input: Record<string, unknown>) {
	const tmdbId = integer(input.tmdbId, 1, 2_147_483_647);
	const season = integer(input.season, 0, 1000);
	const episode = integer(input.episode, 1, 100_000);
	return tmdbId && season !== undefined && episode
		? ([tmdbId, season, episode] as const)
		: null;
}

async function jsonObject(
	c: Context<Env>,
): Promise<Record<string, unknown> | null> {
	const value: unknown = await c.req.json().catch(() => null);
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

async function isChineseSeries(
	db: D1Database,
	tmdbId: number,
): Promise<boolean> {
	const now = Math.floor(Date.now() / 1000);
	const cached = await db
		.prepare(
			"SELECT eligible FROM screen_ad_series WHERE tmdb_id = ? AND expires_at > ?",
		)
		.bind(tmdbId, now)
		.first<number>("eligible");
	return cached === null ? refreshChineseSeries(db, tmdbId, now) : cached === 1;
}

async function refreshChineseSeries(
	db: D1Database,
	tmdbId: number,
	now: number,
): Promise<boolean> {
	const result = await tmdb.GET(`/3/tv/${tmdbId}`, {
		params: { path: { series_id: tmdbId } },
		signal: AbortSignal.timeout(2500),
	});
	if (result.response.status === 404) return false;
	if (!result.data) throw new Error("TMDB series unavailable");
	const eligible = result.data.origin_country?.includes("CN") === true;
	await db
		.prepare(`INSERT INTO screen_ad_series (tmdb_id, eligible, expires_at) VALUES (?, ?, ?)
		ON CONFLICT (tmdb_id) DO UPDATE SET eligible = excluded.eligible, expires_at = excluded.expires_at
		WHERE screen_ad_series.expires_at < excluded.expires_at`)
		.bind(tmdbId, Number(eligible), now + 7 * 86400)
		.run();
	return eligible;
}

function unavailable(c: Context<Env>) {
	return c.json({ error: "Episode timings unavailable" }, 503);
}

app.use("*", async (c, next) => {
	c.header("Cache-Control", "no-store");
	const limiter = c.env?.EPISODE_TIMING_RATE_LIMITER;
	if (!c.env?.DB || !limiter) return unavailable(c);
	const address = c.req.header("CF-Connecting-IP");
	if (!address) return c.json({ error: "Missing client address" }, 403);
	try {
		if (!(await limiter.limit({ key: address })).success) {
			return c.json({ error: "Rate limit reached" }, 429, {
				"Retry-After": "60",
			});
		}
	} catch {
		return unavailable(c);
	}
	await next();
});

async function readAdState(
	db: D1Database,
	key: NonNullable<ReturnType<typeof parseEpisode>>,
	duration: number,
) {
	const { results } = await db
		.prepare(`WITH requested(tmdb_id, season, episode, duration_ms) AS (VALUES (?, ?, ?, ?)),
		${adVersionCTE}
		SELECT a.start_ms AS startMs, a.end_ms AS endMs, c.duration_ms IS NOT NULL AS scanComplete
		FROM requested r
		LEFT JOIN screen_ad_segments a ON a.tmdb_id = r.tmdb_id AND a.season = r.season AND a.episode = r.episode
			AND a.duration_ms = (SELECT duration_ms FROM matched_ad_version)
		LEFT JOIN screen_ad_scan_completions c ON c.tmdb_id = r.tmdb_id AND c.season = r.season
			AND c.episode = r.episode AND c.duration_ms = (SELECT duration_ms FROM matched_ad_version)
		ORDER BY a.start_ms`)
		.bind(...key, duration)
		.all<Pick<TimingRow, "startMs" | "endMs" | "scanComplete">>();
	return {
		segments: results.flatMap(({ startMs, endMs }) =>
			startMs === null || endMs === null ? [] : [{ startMs, endMs }],
		),
		scanComplete: results[0].scanComplete === 1,
	};
}

app.get("/", async (c) => {
	const key = parseEpisode(c.req.query());
	if (!key) return c.json({ error: "Invalid episode" }, 400);
	const db = c.env.DB!;
	const supportsRanges = c.req.query("ranges") === "1";
	const durationInput = c.req.query("durationMs");
	const duration = integer(durationInput, 1, maxTime);
	if (durationInput !== undefined && duration === undefined)
		return c.json({ error: "Invalid video duration" }, 400);
	try {
		if (c.req.query("ads") === "0") {
			const markers = await db
				.prepare(`${markerSelect} ${markerSource}`)
				.bind(...key, duration ?? 0)
				.first<TimingRow>();
			return c.json({
				markers: markerPayload(markers, supportsRanges),
				ads: null,
			});
		}
		const now = Math.floor(Date.now() / 1000);
		const { results } = await db
			.prepare(`${markerSelect},
				CASE WHEN f.tmdb_id IS NOT NULL OR e.no_ads = 1 THEN 1
					WHEN e.ad_start_ms IS NOT NULL THEN 0
					WHEN t.no_ads = 1 THEN 1
					WHEN t.ad_start_ms IS NOT NULL THEN 0
					ELSE coalesce(d.no_ads, 0) END AS confirmedNoAds,
				coalesce(e.ad_start_ms, t.ad_start_ms, d.ad_start_ms) AS manualAdStartMs,
				coalesce(e.ad_end_ms, t.ad_end_ms, d.ad_end_ms) AS manualAdEndMs,
				s.eligible, a.start_ms AS startMs, a.end_ms AS endMs,
				c.duration_ms IS NOT NULL AS scanComplete
			${markerSource}
			LEFT JOIN screen_ad_free_episodes f ON f.tmdb_id = r.tmdb_id AND f.season = r.season AND f.episode = r.episode
			LEFT JOIN screen_ad_series s ON s.tmdb_id = r.tmdb_id AND s.expires_at > ?
			LEFT JOIN screen_ad_segments a ON f.tmdb_id IS NULL AND s.eligible = 1
				AND a.tmdb_id = r.tmdb_id AND a.season = r.season AND a.episode = r.episode
				AND a.duration_ms = (SELECT duration_ms FROM matched_ad_version)
			LEFT JOIN screen_ad_scan_completions c ON c.tmdb_id = r.tmdb_id AND c.season = r.season
				AND c.episode = r.episode AND c.duration_ms = (SELECT duration_ms FROM matched_ad_version)
			ORDER BY a.start_ms`)
			.bind(...key, duration ?? 0, now)
			.all<TimingRow>();
		const first = results[0];
		if (!first) return unavailable(c);
		const markers = markerPayload(first, supportsRanges);
		if (first.confirmedNoAds === 1) {
			return c.json({
				markers,
				ads: {
					confirmedNoAds: true,
					eligible: false,
					scanComplete: true,
					segments: [],
				},
			});
		}
		if (first.manualAdStartMs !== null && first.manualAdEndMs !== null) {
			return c.json({
				markers,
				ads: {
					eligible: true,
					scanComplete: first.scanComplete === 1,
					segments: [
						{ startMs: first.manualAdStartMs, endMs: first.manualAdEndMs },
					],
				},
			});
		}
		if (first.eligible === null) {
			try {
				const eligible = await refreshChineseSeries(db, key[0], now);
				return c.json({
					markers,
					ads: {
						eligible,
						...(eligible
							? await readAdState(db, key, duration ?? 0)
							: { segments: [], scanComplete: false }),
					},
				});
			} catch {
				return c.json({ markers, ads: null });
			}
		}
		const segments = results.flatMap(({ startMs, endMs }) =>
			startMs === null || endMs === null ? [] : [{ startMs, endMs }],
		);
		return c.json({
			markers,
			ads: {
				eligible: first.eligible === 1,
				scanComplete: first.scanComplete === 1,
				segments,
			},
		});
	} catch {
		return unavailable(c);
	}
});

app.post(
	"/",
	bodyLimit({
		maxSize: 1024,
		onError: (c) => c.json({ error: "Timing report too large" }, 413),
	}),
	async (c) => {
		const input = await jsonObject(c);
		const key = input && parseEpisode(input);
		if (!key || !input) return c.json({ error: "Invalid episode" }, 400);
		const db = c.env.DB!;
		try {
			if (input.kind === "ad_scan_complete") {
				const duration = integer(input.durationMs, 1, maxTime);
				if (duration === undefined)
					return c.json({ error: "Invalid video duration" }, 400);
				if (!(await isChineseSeries(db, key[0])))
					return c.json({ error: "Ineligible series" }, 403);
				await db
					.prepare(`WITH requested(tmdb_id, season, episode, duration_ms) AS (VALUES (?, ?, ?, ?)),
					${adVersionCTE}
					INSERT OR IGNORE INTO screen_ad_scan_completions (tmdb_id, season, episode, duration_ms)
					SELECT tmdb_id, season, episode,
						coalesce((SELECT duration_ms FROM matched_ad_version), duration_ms) FROM requested`)
					.bind(...key, duration)
					.run();
			} else if (input.kind === "ad") {
				const start = integer(input.startMs, 0, maxTime);
				const end = integer(input.endMs, 0, maxTime);
				const duration = integer(input.durationMs, 1, maxTime);
				if (
					duration === undefined ||
					(end !== undefined && end > duration) ||
					start === undefined ||
					end === undefined ||
					start >= end
				) {
					return c.json({ error: "Invalid ad segment" }, 400);
				}
				if (!(await isChineseSeries(db, key[0])))
					return c.json({ error: "Ineligible series" }, 403);
				await db
					.prepare(`WITH version AS (
						SELECT coalesce((SELECT duration_ms FROM (
							SELECT duration_ms FROM screen_ad_segments WHERE ${scope}
							UNION SELECT duration_ms FROM screen_ad_scan_completions WHERE ${scope})
							WHERE duration_ms BETWEEN ? AND ?
								AND duration_ms >= ?
							ORDER BY abs(duration_ms - ?), duration_ms LIMIT 1), ?) AS duration
					)
					INSERT INTO screen_ad_segments (tmdb_id, season, episode, start_ms, end_ms, duration_ms)
					SELECT ?, ?, ?, ?, ?, version.duration FROM version WHERE NOT EXISTS (
						SELECT 1 FROM screen_ad_segments WHERE ${scope} AND duration_ms = version.duration
							AND start_ms < ? AND end_ms > ?
					)`)
					.bind(
						...key,
						...key,
						Math.max(1, duration - durationTolerance),
						duration + durationTolerance,
						end,
						duration,
						duration,
						...key,
						start,
						end,
						...key,
						end,
						start,
					)
					.run();
			} else if (input.kind === "intro" || input.kind === "outro") {
				const intro = input.kind === "intro";
				const range = input.startMs !== undefined || input.endMs !== undefined;
				const limit = intro ? 600_000 : maxTime;
				const start = integer(input.startMs, intro ? 0 : 1, limit);
				const end = integer(input.endMs, 1, limit);
				if (
					range &&
					(input.timeMs !== undefined ||
						start === undefined ||
						end === undefined ||
						start >= end)
				) {
					return c.json({ error: "Invalid marker range" }, 400);
				}
				const point = range
					? intro
						? end
						: start
					: integer(input.timeMs, 1, limit);
				if (point === undefined)
					return c.json({ error: "Invalid marker" }, 400);
				const duration = integer(input.durationMs, 1, maxTime);
				if (
					duration === undefined ||
					point >= duration ||
					(end !== undefined && end > duration)
				) {
					return c.json({ error: "Invalid marker duration" }, 400);
				}
				const edge = range ? (intro ? start : end) : null;
				const pointColumn = intro ? "intro_end_ms" : "outro_start_ms";
				const edgeColumn = intro ? "intro_start_ms" : "outro_end_ms";
				const otherColumn = intro ? "outro_start_ms" : "intro_end_ms";
				const table = "episode_intro_outro_versions";
				// Single-point reports leave a saved explicit range intact.
				const updatedPoint = `CASE WHEN excluded.${edgeColumn} IS NULL AND ${table}.${edgeColumn} IS NOT NULL
					THEN ${table}.${pointColumn} ELSE excluded.${pointColumn} END`;
				const saved = await db
					.prepare(`INSERT INTO ${table}
				(tmdb_id, season, episode, ${pointColumn}, ${edgeColumn}, duration_ms) VALUES (?, ?, ?, ?, ?, ?)
				ON CONFLICT (tmdb_id, season, episode, duration_ms) DO UPDATE SET
					${pointColumn} = ${updatedPoint},
					${edgeColumn} = coalesce(excluded.${edgeColumn}, ${table}.${edgeColumn})
				WHERE ${table}.${otherColumn} IS NULL
					OR (${updatedPoint}) ${intro ? "<" : ">"} ${table}.${otherColumn}
				RETURNING tmdb_id`)
					.bind(...key, point, edge ?? null, duration)
					.first<number>("tmdb_id");
				if (saved === null)
					return c.json({ error: "Intro must end before outro starts" }, 409);
			} else {
				return c.json({ error: "Invalid timing kind" }, 400);
			}
			return c.body(null, 204);
		} catch {
			return unavailable(c);
		}
	},
);

export default app;

import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { adScanPageNumber, listAdScanRequests } from "./ad-scan-requests.js";
import { getDb } from "./blocks/runtime.js";
import type { BlocksBindings } from "./blocks/types.js";
import {
	type EditorValues,
	formatTime,
	TimingAdminPage,
	TimingAdRequestsPage,
	TimingDeniedPage,
	TimingMembersPage,
	timingAdminPath,
	timingAdminURL,
} from "./episode-timing-admin-view.js";
import {
	authenticatedTimingEmail,
	type TimingAccessBindings,
	type TimingActor,
	timingAccessConfig,
	timingEmail,
} from "./episode-timing-auth.js";
import { integer, parseEpisode } from "./episode-timings.js";
import { tmdb } from "./tmdb/index.js";

const app = new Hono<{
	Bindings: BlocksBindings & TimingAccessBindings;
	Variables: { actor: TimingActor };
}>();
const idFrom = (value: unknown) => integer(value, 1, 2_147_483_647);
const lookupOptions = () => ({ signal: AbortSignal.timeout(3500) });
type CatalogTitle = {
	id: number;
	name: string;
	poster_path?: string | null;
	backdrop_path?: string | null;
	first_air_date?: string;
};
type Season = { season_number: number; name: string; episode_count: number };
type Episode = {
	episode_number: number;
	name: string;
	still_path?: string | null;
};
type Series = CatalogTitle & { seasons?: Season[] };
type Scope = readonly [number, number, number];
type Rule = {
	introStart: number | null;
	introEnd: number | null;
	outroStart: number | null;
	outroEnd: number | null;
	adStart: number | null;
	adEnd: number | null;
	noAds: number;
};

const timingFields = [
	"introStart",
	"introEnd",
	"outroStart",
	"outroEnd",
	"adStart",
	"adEnd",
] as const;
type TimingField = (typeof timingFields)[number];

class InvalidTiming extends RangeError {
	constructor(
		message: string,
		readonly field: TimingField,
	) {
		super(message);
	}
}

const ruleScope = "tmdb_id = ? AND season = ? AND episode = ?";

function readRule(db: D1Database, scope: Scope) {
	return db
		.prepare(`SELECT intro_start_ms AS introStart, intro_end_ms AS introEnd,
		outro_start_ms AS outroStart, outro_end_ms AS outroEnd, ad_start_ms AS adStart,
		ad_end_ms AS adEnd, no_ads AS noAds FROM playback_timing_rules WHERE ${ruleScope}`)
		.bind(...scope)
		.first<Rule>();
}

function editorValues(rule: Rule | null, oldNoAds: boolean): EditorValues {
	return {
		introStart: formatTime(rule?.introStart),
		introEnd: formatTime(rule?.introEnd),
		outroStart: formatTime(rule?.outroStart),
		outroEnd: formatTime(rule?.outroEnd),
		adStart: formatTime(rule?.adStart),
		adEnd: formatTime(rule?.adEnd),
		adMode:
			rule?.noAds === 1 || oldNoAds
				? "none"
				: rule?.adStart != null
					? "range"
					: "inherit",
	};
}

function milliseconds(value: string) {
	const normalized = value.normalize("NFKC");
	if (!/^\d{1,5}(?::[0-5]?\d){0,2}(?:\.\d{1,3})?$/.test(normalized))
		return Number.NaN;
	const seconds = normalized
		.split(":")
		.reduce((sum, part) => sum * 60 + Number(part), 0);
	return Math.round(seconds * 1000);
}

function timeRange(
	kind: "intro" | "outro" | "ad",
	startText: string,
	endText: string,
	min: number,
	max: number,
	required = false,
) {
	if (!startText && !endText && !required) return [null, null] as const;
	const label = { intro: "片头", outro: "片尾", ad: "广告" }[kind];
	const start = milliseconds(startText);
	const end = milliseconds(endText);
	if (!Number.isFinite(start) || start < min || start >= max) {
		throw new InvalidTiming(
			`请填写有效的${label}开始时间，例如 1:25 或 85。`,
			`${kind}Start`,
		);
	}
	if (!Number.isFinite(end) || end > max || start >= end) {
		throw new InvalidTiming(
			`${label}结束时间须晚于开始时间，并在允许范围内。`,
			`${kind}End`,
		);
	}
	return [start, end] as const;
}

async function catalogTitle(id: number): Promise<Series | null> {
	try {
		const { data } = await tmdb.GET(`/3/tv/${id}`, {
			...lookupOptions(),
			params: { path: { series_id: id }, query: { language: "zh-CN" } },
		});
		return data?.name ? ({ ...data, id, name: data.name } as Series) : null;
	} catch {
		return null;
	}
}

async function catalogEpisodes(
	id: number,
	season: number,
): Promise<Episode[] | null> {
	try {
		const { data } = await tmdb.GET(`/3/tv/${id}/season/${season}`, {
			...lookupOptions(),
			params: {
				path: { series_id: id, season_number: season },
				query: { language: "zh-CN" },
			},
		});
		return (data?.episodes as Episode[] | undefined) ?? null;
	} catch {
		return null;
	}
}

async function searchCatalog(q: string): Promise<CatalogTitle[] | null> {
	try {
		const { data } = await tmdb.GET("/3/search/tv", {
			...lookupOptions(),
			params: { query: { query: q, language: "zh-CN", include_adult: false } },
		});
		return (
			data?.results
				?.flatMap((item) =>
					item.id && item.name
						? [{ ...item, id: item.id, name: item.name }]
						: [],
				)
				.slice(0, 12) ?? null
		);
	} catch {
		return null;
	}
}

app.use("*", async (c, next) => {
	c.header("Cache-Control", "no-store");
	c.header("X-Frame-Options", "DENY");
	const config = timingAccessConfig(c.env);
	if (!config) return c.text("播放标记登录尚未配置。", 503);
	const email = await authenticatedTimingEmail(
		c.req.header("Cf-Access-Jwt-Assertion"),
		config,
	);
	if (!email)
		return c.text("请从 api.eplayerx.com 的播放标记入口使用邮箱登录。", 401);
	if (
		c.req.method === "POST" &&
		c.req.header("Origin") !== new URL(c.req.url).origin
	) {
		return c.text("请求来源无效。", 403);
	}
	const role = email === config.owner ? "owner" : "editor";
	if (role === "editor") {
		try {
			const db = getDb(c);
			const member = await db
				.prepare("SELECT joined_at FROM timing_admin_members WHERE email = ?")
				.bind(email)
				.first<{ joined_at: number | null }>();
			if (!member) {
				return c.req.method === "GET"
					? c.html(<TimingDeniedPage />, 403)
					: c.json({ error: "这个邮箱未获邀，或编辑权限已被移除。" }, 403);
			}
			if (member.joined_at === null) {
				const joined = await db
					.prepare(`UPDATE timing_admin_members SET joined_at = coalesce(joined_at, unixepoch())
					WHERE email = ? RETURNING joined_at`)
					.bind(email)
					.first();
				if (!joined) {
					return c.req.method === "GET"
						? c.html(<TimingDeniedPage />, 403)
						: c.json({ error: "此邀请已移除。" }, 403);
				}
			}
		} catch {
			return c.text("暂时无法确认成员权限，请稍后重试。", 503);
		}
	}
	c.set("actor", { email, role });
	await next();
});

app.get("/ad-requests", async (c) => {
	const page = adScanPageNumber(c.req.query("page"));
	if (page === undefined) return c.text("页码无效。", 400);
	try {
		const list = await listAdScanRequests(getDb(c), page);
		return c.html(
			<TimingAdRequestsPage actor={c.get("actor")} page={page} list={list} />,
		);
	} catch {
		return c.text("暂时无法读取广告提交，请稍后重试。", 503);
	}
});

app.get("/members", async (c) => {
	const actor = c.get("actor");
	if (actor.role !== "owner") return c.text("只有所有者可以管理成员。", 403);
	try {
		const db = getDb(c);
		const [members, audit] = await Promise.all([
			db
				.prepare(
					"SELECT email, joined_at AS joinedAt FROM timing_admin_members ORDER BY invited_at DESC, email",
				)
				.all<{ email: string; joinedAt: number | null }>(),
			db
				.prepare(`SELECT actor_email AS email, action, subject, details, created_at AS createdAt
				FROM timing_admin_audit ORDER BY id DESC LIMIT 40`)
				.all<{
					email: string;
					action: string;
					subject: string;
					details: string | null;
					createdAt: number;
				}>(),
		]);
		return c.html(
			<TimingMembersPage
				actor={actor}
				members={members.results}
				audit={audit.results}
				status={c.req.query("status")}
			/>,
		);
	} catch {
		return c.text("成员列表暂不可用，请稍后重试。", 503);
	}
});

app.post("/members", bodyLimit({ maxSize: 2048 }), async (c) => {
	const actor = c.get("actor");
	if (actor.role !== "owner") return c.text("只有所有者可以管理成员。", 403);
	const input = await c.req.parseBody();
	const email = timingEmail(input.email);
	const action = input.action;
	const membersURL = `${timingAdminPath}/members`;
	if (
		!email ||
		email === actor.email ||
		(action !== "invite" && action !== "remove")
	) {
		return c.redirect(`${membersURL}?status=invalid`, 303);
	}
	try {
		const db = getDb(c);
		const change =
			action === "invite"
				? db
						.prepare(
							"INSERT INTO timing_admin_members (email) VALUES (?) ON CONFLICT DO NOTHING",
						)
						.bind(email)
				: db
						.prepare("DELETE FROM timing_admin_members WHERE email = ?")
						.bind(email);
		const [, result] = await db.batch([
			db
				.prepare(`INSERT INTO timing_admin_audit (actor_email, action, subject) SELECT ?, ?, ?
				WHERE ${action === "invite" ? "NOT " : ""}EXISTS (SELECT 1 FROM timing_admin_members WHERE email = ?)`)
				.bind(actor.email, action, email, email),
			change,
		]);
		return c.redirect(
			`${membersURL}?status=${result.meta.changes === 1 ? action : "unchanged"}`,
			303,
		);
	} catch {
		return c.redirect(`${membersURL}?status=error`, 303);
	}
});

app.get("/", async (c) => {
	const actor = c.get("actor");
	const q = (c.req.query("q") ?? "").trim().slice(0, 160);
	const id = idFrom(c.req.query("tmdbId"));
	if (q) {
		const exactID = idFrom(q);
		if (exactID)
			return c.redirect(
				`${timingAdminURL(exactID, undefined, "episode")}#timing-editor`,
			);
		const results = await searchCatalog(q);
		return c.html(
			<TimingAdminPage actor={actor} query={q} results={results} />,
		);
	}
	if (c.req.query("tmdbId") && id === undefined) {
		return c.html(
			<TimingAdminPage actor={actor} error="请输入有效的 TMDB 剧集 ID。" />,
			400,
		);
	}
	if (id === undefined) return c.html(<TimingAdminPage actor={actor} />);
	try {
		const requestedSeason = integer(c.req.query("season"), 0, 1000);
		const requestedScope = c.req.query("scope");
		let season = requestedSeason ?? 1;
		let episode = integer(c.req.query("episode"), 1, 100_000);
		const catalog = catalogTitle(id);
		let catalogSeason = catalogEpisodes(id, season);
		if (requestedScope === "episode" && episode === undefined) {
			let episodes = await catalogSeason;
			if (!episodes?.length && requestedSeason === undefined) {
				const firstSeason = (await catalog)?.seasons?.find(
					(item) =>
						item.episode_count > 0 &&
						integer(item.season_number, 0, 1000) !== undefined,
				)?.season_number;
				if (firstSeason !== undefined && firstSeason !== season) {
					season = firstSeason;
					catalogSeason = catalogEpisodes(id, season);
					episodes = await catalogSeason;
				}
			}
			episode = episodes?.find(
				(item) => integer(item.episode_number, 1, 100_000) !== undefined,
			)?.episode_number;
		}
		const editingScope =
			episode !== undefined
				? "episode"
				: requestedScope === "episode"
					? "select"
					: requestedScope === "season"
						? "season"
						: "series";
		const seriesScope = [id, -1, 0] as const;
		const seasonScope = [id, season, 0] as const;
		const scope = [id, season, episode ?? 0] as const;
		const db = getDb(c);
		const [
			series,
			episodes,
			seriesRule,
			seasonRule,
			episodeRule,
			oldNoAds,
			report,
			ad,
		] = await Promise.all([
			catalog,
			catalogSeason,
			readRule(db, seriesScope),
			editingScope === "season" || editingScope === "episode"
				? readRule(db, seasonScope)
				: null,
			episode === undefined ? null : readRule(db, scope),
			episode === undefined
				? null
				: db
						.prepare(`SELECT 1 FROM screen_ad_free_episodes WHERE ${ruleScope}`)
						.bind(...scope)
						.first(),
			episode === undefined
				? null
				: db
						.prepare(`SELECT intro_start_ms AS introStart, intro_end_ms AS introEnd,
				outro_start_ms AS outroStart, outro_end_ms AS outroEnd FROM episode_intro_outro WHERE ${ruleScope}`)
						.bind(...scope)
						.first<Rule>(),
			episode === undefined
				? null
				: db
						.prepare(`SELECT start_ms AS adStart, end_ms AS adEnd
				FROM screen_ad_segments WHERE ${ruleScope}`)
						.bind(...scope)
						.first<Rule>(),
		]);
		return c.html(
			<TimingAdminPage
				actor={actor}
				workspace={{
					id,
					season,
					episode,
					editingScope,
					series,
					episodes,
					seriesRule,
					seasonRule,
					report,
					ad,
					values: editorValues(
						editingScope === "series"
							? seriesRule
							: editingScope === "season"
								? seasonRule
								: episodeRule,
						oldNoAds !== null,
					),
				}}
			/>,
		);
	} catch {
		return c.html(
			<TimingAdminPage
				actor={actor}
				error="时间轴数据库暂不可用。请确认已应用数据库迁移后重试。"
			/>,
			503,
		);
	}
});

app.post("/save", bodyLimit({ maxSize: 4096 }), async (c) => {
	const actor = c.get("actor");
	const input = await c.req.parseBody();
	const id = idFrom(input.tmdbId);
	const series = input.scope === "series";
	const seasonDefault = input.scope === "season";
	if ((series || seasonDefault) && actor.role !== "owner")
		return c.json({ error: "只有所有者可以修改整季和整剧默认值。" }, 403);
	const seasonNumber = integer(input.season, 0, 1000);
	const scope =
		series && id !== undefined
			? ([id, -1, 0] as const)
			: seasonDefault && id !== undefined && seasonNumber !== undefined
				? ([id, seasonNumber, 0] as const)
				: input.scope === "episode"
					? parseEpisode(input)
					: null;
	if (!scope) return c.json({ error: "请选择有效的剧集、季或分集。" }, 400);
	const adMode = input.adMode;
	if (adMode !== "inherit" && adMode !== "none" && adMode !== "range") {
		return c.json({ error: "请选择有效的广告设置。" }, 400);
	}
	const values = (key: TimingField) =>
		typeof input[key] === "string" ? input[key].trim() : "";
	try {
		const [introStart, introEnd] = timeRange(
			"intro",
			values("introStart"),
			values("introEnd"),
			0,
			600_000,
		);
		const [outroStart, outroEnd] = timeRange(
			"outro",
			values("outroStart"),
			values("outroEnd"),
			1,
			28_800_000,
		);
		if (introEnd !== null && outroStart !== null && introEnd >= outroStart) {
			throw new InvalidTiming("片尾开始时间须晚于片头结束时间。", "outroStart");
		}
		const [adStart, adEnd] =
			adMode === "range"
				? timeRange(
						"ad",
						values("adStart"),
						values("adEnd"),
						0,
						28_800_000,
						true,
					)
				: [null, null];
		const db = getDb(c);
		const editorEmail = actor.role === "editor" ? actor.email : null;
		const canWrite =
			"(? IS NULL OR EXISTS (SELECT 1 FROM timing_admin_members WHERE email = ?))";
		const rule =
			introStart === null && outroStart === null && adMode === "inherit"
				? db
						.prepare(
							`DELETE FROM playback_timing_rules WHERE ${ruleScope} AND ${canWrite}`,
						)
						.bind(...scope, editorEmail, editorEmail)
				: db
						.prepare(`INSERT INTO playback_timing_rules
				(tmdb_id, season, episode, intro_start_ms, intro_end_ms, outro_start_ms, outro_end_ms, ad_start_ms, ad_end_ms, no_ads)
				SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${canWrite}
				ON CONFLICT (tmdb_id, season, episode) DO UPDATE SET
				intro_start_ms = excluded.intro_start_ms, intro_end_ms = excluded.intro_end_ms,
				outro_start_ms = excluded.outro_start_ms, outro_end_ms = excluded.outro_end_ms,
				ad_start_ms = excluded.ad_start_ms, ad_end_ms = excluded.ad_end_ms, no_ads = excluded.no_ads`)
						.bind(
							...scope,
							introStart,
							introEnd,
							outroStart,
							outroEnd,
							adStart,
							adEnd,
							Number(adMode === "none"),
							editorEmail,
							editorEmail,
						);
		const [tmdbId, season, episode] = scope;
		const subject = `TMDB ${tmdbId} · ${series ? "整剧" : seasonDefault ? `第 ${season} 季` : `S${season} E${episode}`}`;
		const audit = db
			.prepare(`INSERT INTO timing_admin_audit (actor_email, action, subject, details)
			SELECT ?, 'save', ?, ? WHERE ${canWrite}`)
			.bind(
				actor.email,
				subject,
				JSON.stringify({
					introStart,
					introEnd,
					outroStart,
					outroEnd,
					adMode,
					adStart,
					adEnd,
				}),
				editorEmail,
				editorEmail,
			);
		const changes = [audit, rule];
		if (episode > 0) {
			changes.push(
				db
					.prepare(
						`DELETE FROM screen_ad_free_episodes WHERE ${ruleScope} AND ${canWrite}`,
					)
					.bind(...scope, editorEmail, editorEmail),
			);
		}
		const [recorded] = await db.batch(changes);
		if (recorded.meta.changes !== 1)
			return c.json({ error: "你的编辑权限已被移除。" }, 403);
		return c.json({ saved: true });
	} catch (error) {
		if (error instanceof InvalidTiming)
			return c.json({ error: error.message, field: error.field }, 400);
		return c.json({ error: "保存失败，请稍后重试。" }, 503);
	}
});

export default app;

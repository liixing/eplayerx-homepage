import { raw } from "hono/html";
import type { Child } from "hono/jsx";
import type { AdScanRequestPage } from "./ad-scan-requests.js";
import type { TimingActor } from "./episode-timing-auth.js";

export const timingAdminPath = "/admin/episode-timings";
const adRequestsPath = `${timingAdminPath}/ad-requests`;

const brandMark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <defs><linearGradient id="brand" x1="0" y1="1" x2="1" y2="0">
    <stop stop-color="#bbff9d"/><stop offset="1" stop-color="#00f4ff"/>
  </linearGradient></defs>
  <g fill="url(#brand)" transform="rotate(-9 100 100)">
    <path d="M50 37h98a15 15 0 0 1 0 30H50a9 9 0 0 1-9-9V46a9 9 0 0 1 9-9Z"/>
    <rect x="29" y="85" width="65" height="32" rx="16"/>
    <path d="M110 87c2-5 7-5 13-2 7 3 14 9 14 14 0 5-8 10-15 13-7 3-12 2-14-3-2-6-1-17 2-22Z"/>
    <path d="M59 129h90a15 15 0 0 1 0 30H59a9 9 0 0 1-9-9v-12a9 9 0 0 1 9-9Z"/>
  </g>
</svg>`;
const brandIcon = `data:image/svg+xml,${encodeURIComponent(brandMark)}`;

export type EditorValues = {
	introStart: string;
	introEnd: string;
	outroStart: string;
	outroEnd: string;
	adStart: string;
	adEnd: string;
	adMode: string;
	duration: string;
};

export function formatTime(ms: number | null | undefined) {
	if (ms == null) return "";
	const seconds = Math.floor(ms / 1000);
	const clock = [Math.floor(seconds / 60), seconds % 60]
		.map((part) => String(part).padStart(2, "0"))
		.join(":");
	const fraction = ms % 1000;
	return fraction
		? `${clock}.${String(fraction).padStart(3, "0").replace(/0+$/, "")}`
		: clock;
}

export function timingAdminURL(
	id: number,
	season?: number,
	episode?: number | "season" | "episode",
	duration?: number | "new",
) {
	const query = new URLSearchParams({ tmdbId: String(id) });
	if (season !== undefined) query.set("season", String(season));
	if (typeof episode === "string") query.set("scope", episode);
	else if (episode !== undefined) query.set("episode", String(episode));
	if (duration !== undefined) query.set("duration", String(duration));
	return `${timingAdminPath}?${query}`;
}

type Title = {
	id: number;
	name: string;
	first_air_date?: string;
	poster_path?: string | null;
	backdrop_path?: string | null;
};
type TimingValues = {
	introStart: number | null;
	introEnd: number | null;
	outroStart: number | null;
	outroEnd: number | null;
	adStart: number | null;
	adEnd: number | null;
	noAds: number;
};
type InheritedRules = { label: string; rule: TimingValues | null }[];
export type MarkerReport = Pick<
	TimingValues,
	"introStart" | "introEnd" | "outroStart" | "outroEnd"
> & {
	duration: number | null;
};
type Workspace = {
	id: number;
	season: number;
	episode?: number;
	editingScope: "series" | "season" | "episode" | "select";
	series:
		| (Title & {
				seasons?: {
					season_number: number;
					name: string;
					episode_count: number;
				}[];
		  })
		| null;
	episodes:
		| { episode_number: number; name: string; still_path?: string | null }[]
		| null;
	seriesRule: TimingValues | null;
	seasonRule: TimingValues | null;
	reports: MarkerReport[];
	ad: TimingValues | null;
	values: EditorValues;
	durations: number[];
	originalDuration: number | null;
};

const glyphs = {
	search: "m20 20-4.4-4.4M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z",
	clock: "M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
	arrow: "M5 12h14m-6-6 6 6-6 6",
	film: "M3 7h18v13H3zM3 7l16-4 2 4M8 6l2 4m4-5 2 4",
	opening: "M6 5v14m12-7H8m4-4-4 4 4 4",
	ending: "M18 5v14m-12-7h10m-4-4 4 4-4 4",
	ad: "M5 7h14v10H5zM9 4v3m6-3v3M9 17v3m6-3v3m-8-8h10",
} as const;

function Icon({ name }: { name: keyof typeof glyphs }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.6"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<path d={glyphs[name]} />
		</svg>
	);
}

function tmdbImage(
	path: string | null | undefined,
	size: "w185" | "w300" | "w780" | "w1280",
) {
	return path && /^\/[a-z\d_.-]+$/i.test(path)
		? `https://image.tmdb.org/t/p/${size}${path}`
		: undefined;
}

function Poster({ title }: { title?: Title | null }) {
	const src = tmdbImage(title?.poster_path, "w185");
	return src ? (
		<img class="poster" src={src} alt="" loading="lazy" />
	) : (
		<div class="poster poster-fallback">
			<Icon name="film" />
		</div>
	);
}

function Backdrop({ title }: { title?: Title | null }) {
	const src = tmdbImage(title?.backdrop_path, "w1280");
	if (!src) return null;
	return (
		<picture class="backdrop">
			<source
				media="(max-width: 640px)"
				srcset={tmdbImage(title?.backdrop_path, "w780")}
			/>
			<img src={src} alt="" fetchpriority="high" />
		</picture>
	);
}

function showRange(
	start: number | null | undefined,
	end: number | null | undefined,
) {
	if (start == null && end == null) return "";
	if (start == null) return `结束 ${formatTime(end)}`;
	if (end == null) return `开始 ${formatTime(start)}`;
	return `${formatTime(start)} – ${formatTime(end)}`;
}

function TimeFields({
	prefix,
	values,
}: {
	prefix: "intro" | "outro" | "ad";
	values: EditorValues;
}) {
	return (
		<div class="time-pair">
			<label>
				开始时间
				<input
					name={`${prefix}Start`}
					value={values[`${prefix}Start`]}
					placeholder="00:00"
					autocomplete="off"
					maxlength={15}
				/>
			</label>
			<span aria-hidden="true">→</span>
			<label>
				结束时间
				<input
					name={`${prefix}End`}
					value={values[`${prefix}End`]}
					placeholder="00:00"
					autocomplete="off"
					maxlength={15}
				/>
			</label>
		</div>
	);
}

function MarkerCard({
	kind,
	values,
	parents,
	reports,
}: {
	kind: "intro" | "outro";
	values: EditorValues;
	parents: InheritedRules;
	reports: MarkerReport[];
}) {
	const intro = kind === "intro";
	const title = intro ? "片头" : "片尾";
	const parent = parents.find(({ rule }) => rule?.[`${kind}Start`] != null);
	const references = reports.map(({ duration, ...rule }) => ({
		label:
			duration === null
				? "已收集 · 时长未知"
				: `已收集 · ${formatTime(duration)}`,
		rule,
	}));
	if (parent?.rule)
		references.unshift({ label: parent.label, rule: parent.rule });
	return (
		<section class={`card marker ${kind}`} id={`timing-${kind}`} tabindex={-1}>
			<div class="card-head">
				<div class={`tile ${kind}`}>
					<Icon name={intro ? "opening" : "ending"} />
				</div>
				<h3>{title}</h3>
				<button
					class="quiet clear"
					type="button"
					data-time-pair={kind}
					aria-label={`清空${title}区间`}
				>
					清空
				</button>
			</div>
			<TimeFields prefix={kind} values={values} />
			{references.map(({ label, rule }) => {
				const start = rule[`${kind}Start`];
				const end = rule[`${kind}End`];
				const range = showRange(start, end);
				return range ? (
					<div class="source reference">
						<span>
							{label} {range}
						</span>
						{start != null && end != null ? (
							<button
								class="quiet clear"
								type="button"
								data-time-pair={kind}
								data-start={formatTime(start)}
								data-end={formatTime(end)}
								aria-label={`填入参考${title}区间`}
							>
								填入
							</button>
						) : null}
					</div>
				) : null;
			})}
		</section>
	);
}

function DurationCard({ workspace }: { workspace: Workspace }) {
	const { id, season, episode, values, durations, originalDuration, reports } =
		workspace;
	const collected = [
		...new Set(
			reports.flatMap(({ duration }) =>
				duration === null || durations.includes(duration) ? [] : [duration],
			),
		),
	];
	return (
		<section class="card duration-card" id="timing-duration" tabindex={-1}>
			<div class="card-head">
				<div class="tile duration">
					<Icon name="clock" />
				</div>
				<div>
					<h3>视频时长</h3>
					<p class="hint">按时长区分片源，播放时在 ±10 秒内匹配。</p>
				</div>
			</div>
			<div class="duration-row">
				<label class="duration-input">
					<span class="sr-only">视频时长</span>
					<input
						name="duration"
						value={values.duration}
						placeholder="45:00"
						autocomplete="off"
						maxlength={15}
						required
					/>
				</label>
				<nav class="chips" aria-label="已保存的时长版本">
					{durations.map((duration) => (
						<a
							class="chip"
							href={`${timingAdminURL(id, season, episode, duration)}#timing-editor`}
							aria-current={duration === originalDuration ? "page" : undefined}
						>
							{formatTime(duration)}
						</a>
					))}
					{durations.length ? (
						<a
							class="chip add"
							href={`${timingAdminURL(id, season, episode, "new")}#timing-editor`}
							aria-current={originalDuration === null ? "page" : undefined}
						>
							+ 新版本
						</a>
					) : null}
				</nav>
			</div>
			{collected.length ? (
				<div class="source reference">
					<span>已收集时长</span>
					{collected.map((duration) => (
						<button
							class="quiet clear"
							type="button"
							data-duration={formatTime(duration)}
						>
							{formatTime(duration)}
						</button>
					))}
				</div>
			) : null}
			<div class="timeline" data-timeline aria-hidden="true">
				<div class="track">
					<i class="seg intro" data-kind="intro" hidden></i>
					<i class="seg ad" data-kind="ad" hidden></i>
					<i class="seg outro" data-kind="outro" hidden></i>
				</div>
				<div class="ticks">
					<span>00:00</span>
					<span class="legend">
						<b class="intro">片头</b>
						<b class="ad">广告</b>
						<b class="outro">片尾</b>
					</span>
					<span class="total"></span>
				</div>
			</div>
		</section>
	);
}

function Editor({ workspace }: { workspace: Workspace }) {
	const {
		id,
		season,
		episode,
		editingScope,
		seriesRule,
		seasonRule,
		values,
		reports,
		ad,
	} = workspace;
	const series = editingScope === "series";
	const seasonDefault = editingScope === "season";
	const parents: InheritedRules = [];
	if (editingScope === "episode")
		parents.push({ label: "整季默认", rule: seasonRule });
	if (!series) parents.push({ label: "整剧默认", rule: seriesRule });
	const episodes = workspace.episodes ?? [];
	const episodeIndex = episodes.findIndex(
		(item) => item.episode_number === episode,
	);
	const selectedEpisode = episodes[episodeIndex];
	const episodeTitle = selectedEpisode?.name;
	const still = tmdbImage(selectedEpisode?.still_path, "w300");
	const previous = episodeIndex > 0 ? episodes[episodeIndex - 1] : undefined;
	const next = episodeIndex >= 0 ? episodes[episodeIndex + 1] : undefined;
	const collectedAd = showRange(ad?.adStart, ad?.adEnd);
	const adParent = parents.find(
		({ rule }) => rule?.noAds === 1 || rule?.adStart != null,
	);
	const inheritedAd = showRange(adParent?.rule?.adStart, adParent?.rule?.adEnd);
	const scopeName = series ? "本剧各集" : seasonDefault ? "本季各集" : "本集";
	const scopeLabel = series ? "整剧" : seasonDefault ? "整季" : "本集";
	return (
		<form
			class="editor"
			method="post"
			action={`${timingAdminPath}/save`}
			id="timing-editor"
			tabindex={-1}
		>
			<input type="hidden" name="tmdbId" value={id} />
			<input type="hidden" name="season" value={season} />
			<input type="hidden" name="scope" value={editingScope} />
			{episode !== undefined ? (
				<input type="hidden" name="episode" value={episode} />
			) : null}
			{episode !== undefined && workspace.originalDuration !== null ? (
				<input
					type="hidden"
					name="originalDuration"
					value={workspace.originalDuration}
				/>
			) : null}
			<div class="editor-heading">
				<div class="editor-title">
					{still ? (
						<img
							class="editor-still"
							src={still}
							alt=""
							width={88}
							height={50}
						/>
					) : null}
					<div>
						<span class="scope">
							{series
								? "全剧设置"
								: seasonDefault
									? `第 ${season} 季`
									: `第 ${season} 季 · 第 ${episode} 集`}
						</span>
						<h2>
							{series
								? "整剧默认"
								: seasonDefault
									? "整季默认"
									: episodeTitle || `第 ${episode} 集`}
						</h2>
					</div>
				</div>
				<div class="episode-actions">
					<a class="quiet" href="#timing-library">
						选季 / 集
					</a>
					{previous ? (
						<a
							class="quiet"
							href={`${timingAdminURL(id, season, previous.episode_number)}#timing-editor`}
						>
							上一集
						</a>
					) : null}
					{next ? (
						<a
							class="quiet"
							href={`${timingAdminURL(id, season, next.episode_number)}#timing-editor`}
						>
							下一集
						</a>
					) : null}
				</div>
			</div>
			<p class="editor-note">
				{series
					? "整季和单集设置优先。默认设置不区分视频时长。"
					: seasonDefault
						? "单集设置优先。留空的区间沿用整剧默认，不区分视频时长。"
						: "必须填写视频时长。留空的区间依次沿用整季、整剧或已收集的数据。"}
			</p>
			<div class="editor-tools">
				<nav class="marker-links" aria-label="跳转到播放区间">
					<a href="#timing-intro">
						<Icon name="opening" />
						片头
					</a>
					<a href="#timing-outro">
						<Icon name="ending" />
						片尾
					</a>
					<a href="#timing-ad">
						<Icon name="ad" />
						广告
					</a>
				</nav>
				<span class="time-format">例如 1:25 或 85 秒</span>
			</div>
			<fieldset class="editor-fields">
				<legend class="sr-only">播放区间</legend>
				{editingScope === "episode" ? (
					<DurationCard workspace={workspace} />
				) : null}
				<div class="markers">
					<MarkerCard
						kind="intro"
						values={values}
						parents={parents}
						reports={reports}
					/>
					<MarkerCard
						kind="outro"
						values={values}
						parents={parents}
						reports={reports}
					/>
				</div>
				<fieldset class="card ad-card" id="timing-ad" tabindex={-1}>
					<legend class="sr-only">广告设置</legend>
					<div class="card-head">
						<div class="tile ad">
							<Icon name="ad" />
						</div>
						<h3>广告设置</h3>
					</div>
					<div class="choices">
						<label>
							<input
								type="radio"
								name="adMode"
								value="inherit"
								checked={values.adMode === "inherit"}
							/>
							<span>{series ? "按现有规则扫描" : "沿用默认"}</span>
						</label>
						<label>
							<input
								type="radio"
								name="adMode"
								value="none"
								checked={values.adMode === "none"}
							/>
							<span>
								{series
									? "整部剧无广告"
									: seasonDefault
										? "整季无广告"
										: "本集无广告"}
							</span>
						</label>
						<label>
							<input
								type="radio"
								name="adMode"
								value="range"
								checked={values.adMode === "range"}
							/>
							<span>设置广告区间</span>
						</label>
					</div>
					<div class="ad-fields">
						<TimeFields prefix="ad" values={values} />
					</div>
					{adParent?.rule?.noAds === 1 ? (
						<p class="inherit-note source">{adParent.label}已标记无广告。</p>
					) : inheritedAd ? (
						<p class="inherit-note source">
							{adParent?.label} {inheritedAd}
						</p>
					) : null}
					{collectedAd ? <p class="source">已收集 {collectedAd}</p> : null}
				</fieldset>
			</fieldset>
			<div class="savebar">
				<p id="save-result" role="status" aria-live="polite"></p>
				<button class="button primary save" type="submit">
					保存{scopeLabel}设置 <Icon name="arrow" />
				</button>
			</div>
		</form>
	);
}

function EpisodeList({ workspace }: { workspace: Workspace }) {
	const { id, season, episode, editingScope, series, episodes } = workspace;
	const seasons =
		series?.seasons?.filter(
			(item) => Number.isInteger(item.season_number) && item.episode_count > 0,
		) ?? [];
	return (
		<aside
			class="library"
			id="timing-library"
			tabindex={-1}
			aria-label="选择编辑范围"
		>
			<h2 class="library-title">编辑范围</h2>
			{seasons.length ? (
				<form
					class="season-picker"
					method="get"
					action={`${timingAdminPath}#timing-editor`}
				>
					<input type="hidden" name="tmdbId" value={id} />
					<input
						type="hidden"
						name="scope"
						value={editingScope === "season" ? "season" : "episode"}
					/>
					<label class="sr-only" for="season-picker">
						选择季
					</label>
					<select id="season-picker" name="season">
						{seasons.map((item) => (
							<option
								value={item.season_number}
								selected={season === item.season_number}
							>
								{item.name || `第 ${item.season_number} 季`}
							</option>
						))}
					</select>
					<button type="submit" class="quiet">
						切换季
					</button>
				</form>
			) : null}
			<nav class="scope-links" aria-label="整剧和整季">
				<a
					class="series-link"
					href={`${timingAdminURL(id, season)}#timing-editor`}
					aria-current={editingScope === "series" ? "page" : undefined}
				>
					整剧默认
				</a>
				<a
					class="series-link"
					href={`${timingAdminURL(id, season, "season")}#timing-editor`}
					aria-current={editingScope === "season" ? "page" : undefined}
				>
					第 {season} 季默认
				</a>
			</nav>
			<div class="list-head">
				<h2>分集</h2>
				{episodes ? <span>{episodes.length} 集</span> : null}
			</div>
			{episodes?.length ? (
				<nav class="episode-list" aria-label="分集">
					{episodes.map((item) => {
						const still = tmdbImage(item.still_path, "w300");
						return (
							<a
								href={`${timingAdminURL(id, season, item.episode_number)}#timing-editor`}
								aria-current={
									episode === item.episode_number ? "page" : undefined
								}
							>
								<span class="episode-still">
									{still ? (
										<img src={still} alt="" loading="lazy" />
									) : (
										<Icon name="film" />
									)}
								</span>
								<span class="episode-caption">
									<span class="episode-index">第 {item.episode_number} 集</span>
									<span class="episode-name">
										{item.name || `第 ${item.episode_number} 集`}
									</span>
								</span>
							</a>
						);
					})}
				</nav>
			) : (
				<p class="source">暂无法读取分集，可以手动输入季、集。</p>
			)}
			<details class="jump" open={episodes?.length ? undefined : true}>
				<summary>手动选择分集</summary>
				<form method="get" action={`${timingAdminPath}#timing-editor`}>
					<input type="hidden" name="tmdbId" value={id} />
					<label>
						季
						<input
							type="number"
							name="season"
							min="0"
							max="1000"
							value={season}
							required
						/>
					</label>
					<label>
						集
						<input
							type="number"
							name="episode"
							min="1"
							max="100000"
							value={episode ?? 1}
							required
						/>
					</label>
					<button class="quiet" type="submit">
						打开
					</button>
				</form>
			</details>
		</aside>
	);
}

function TimingLayout({
	actor,
	page,
	children,
}: {
	actor?: TimingActor;
	page: "timing" | "members" | "adRequests";
	children: Child;
}) {
	const titles = {
		timing: "播放标记",
		members: "成员管理",
		adRequests: "广告提交",
	};
	return (
		<html lang="zh-Hans">
			<head>
				<meta charset="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<meta name="theme-color" content="#05070b" />
				<title>{titles[page]} · EplayerX</title>
				<link rel="icon" type="image/svg+xml" href={brandIcon} />
				<style>{raw(styles)}</style>
			</head>
			<body>
				<header class="topbar">
					<div class="shell topbar-inner">
						<a class="brand" href={timingAdminPath}>
							<img
								class="brand-icon"
								src={brandIcon}
								alt=""
								width={38}
								height={38}
							/>
							<span>EplayerX</span>
						</a>
						<nav aria-label="管理后台">
							<a
								href={timingAdminPath}
								aria-current={page === "timing" ? "page" : undefined}
							>
								播放标记
							</a>
							{actor ? (
								<a
									href={adRequestsPath}
									aria-current={page === "adRequests" ? "page" : undefined}
								>
									广告提交
								</a>
							) : null}
							{actor?.role === "owner" ? (
								<a
									href={`${timingAdminPath}/members`}
									aria-current={page === "members" ? "page" : undefined}
								>
									成员管理
								</a>
							) : null}
							<a href="/cdn-cgi/access/logout">退出</a>
						</nav>
					</div>
				</header>
				<main class="shell">{children}</main>
			</body>
		</html>
	);
}

export function TimingDeniedPage() {
	return (
		<TimingLayout page="timing">
			<section class="empty">
				<h1>这个邮箱未获邀</h1>
				<p>请联系后台所有者，或退出后使用收到邀请的邮箱登录。</p>
				<a class="button" href="/cdn-cgi/access/logout">
					退出并切换邮箱
				</a>
			</section>
		</TimingLayout>
	);
}

export function TimingAdminPage({
	actor,
	query,
	results,
	workspace,
	error,
}: {
	actor: TimingActor;
	query?: string;
	results?: Title[] | null;
	workspace?: Workspace;
	error?: string;
}) {
	return (
		<TimingLayout actor={actor} page="timing">
			<div class="page-head">
				<h1>播放标记</h1>
				<form
					class="search"
					action={timingAdminPath}
					method="get"
					role="search"
				>
					<Icon name="search" />
					<input
						name="q"
						aria-label="剧名或 TMDB ID"
						value={query}
						placeholder="搜索剧名或输入 TMDB ID"
						maxlength={160}
						required
					/>
					<button class="button" type="submit">
						查找
					</button>
				</form>
			</div>
			{error ? (
				<p class="error" role="alert">
					{error}
				</p>
			) : null}
			{workspace ? (
				<div class="work-grid">
					<EpisodeList workspace={workspace} />
					<div class="series-hero">
						<Backdrop title={workspace.series} />
						<Poster title={workspace.series} />
						<div class="series-copy">
							<div class="eyebrow">
								TMDB {workspace.id}
								{workspace.series?.first_air_date
									? ` · ${workspace.series.first_air_date.slice(0, 4)}`
									: ""}
							</div>
							<h2>{workspace.series?.name || `剧集 ${workspace.id}`}</h2>
							<span
								class="badge"
								id="series-ad-free"
								hidden={workspace.seriesRule?.noAds !== 1}
							>
								整剧无广告
							</span>
						</div>
					</div>
					{workspace.editingScope === "select" ? (
						<section class="editor empty" id="timing-editor" tabindex={-1}>
							<h2>选择要编辑的分集</h2>
							<p>请切换季，或手动输入季和集数。</p>
							<a class="button" href="#timing-library">
								选季 / 集
							</a>
						</section>
					) : (
						<Editor workspace={workspace} />
					)}
				</div>
			) : query ? (
				<section class="search-results">
					<h2>搜索结果</h2>
					{results?.length ? (
						<div class="result-grid">
							{results.map((title) => (
								<a
									class="card result"
									href={`${timingAdminURL(title.id, undefined, "episode")}#timing-editor`}
								>
									<Poster title={title} />
									<div>
										<strong>{title.name}</strong>
										<span>
											{title.first_air_date?.slice(0, 4) || `TMDB ${title.id}`}
										</span>
									</div>
								</a>
							))}
						</div>
					) : (
						<p class="source">
							{results
								? "没有找到匹配的剧集。"
								: "暂时无法搜索，可以输入 TMDB ID 直接打开。"}
						</p>
					)}
				</section>
			) : !error ? (
				<section class="empty landing">
					<img
						class="landing-mark"
						src={brandIcon}
						alt=""
						width={74}
						height={74}
					/>
					<h2>选择要管理的剧集</h2>
					<p>搜索剧名或 TMDB ID，打开剧集的播放标记。</p>
				</section>
			) : null}
			<script>{raw(client)}</script>
		</TimingLayout>
	);
}

type Member = { email: string; joinedAt: number | null };
type AuditEntry = {
	email: string;
	action: string;
	subject: string;
	details: string | null;
	createdAt: number;
};

const memberFeedback: Record<string, string> = {
	invite: "邀请已创建，复制登录链接发给对方即可。",
	remove: "编辑权限已移除。",
	invalid: "请输入有效的编辑者邮箱。",
	unchanged: "成员名单没有变化。",
	error: "暂时无法保存，请重试。",
};
const auditLabels: Record<string, string> = {
	invite: "邀请",
	remove: "移除",
	save: "保存标记",
};

const adRequestStatus = {
	processing: "处理中",
	waiting_resource: "等待资源",
	completed: "已处理",
};

function episodeKey(season: number, episode: number) {
	return `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
}

export function TimingAdRequestsPage({
	actor,
	page,
	list,
}: {
	actor: TimingActor;
	page: number;
	list: AdScanRequestPage;
}) {
	return (
		<TimingLayout actor={actor} page="adRequests">
			<div class="page-head">
				<h1>广告提交</h1>
			</div>
			<section class="card member-card">
				{list.requests.length ? (
					<ul class="member-list ad-request-list">
						{list.requests.map((item) => {
							const check =
								item.nextCheckAt === null
									? null
									: new Date(item.nextCheckAt * 1000).toISOString();
							const season = item.lastSeason;
							const episode = item.lastEpisode;
							return (
								<li>
									<div class="ad-request-show">
										{item.posterPath ? (
											<img
												src={`https://image.tmdb.org/t/p/w92${item.posterPath}`}
												width="32"
												height="48"
												alt=""
												loading="lazy"
											/>
										) : null}
										<div>
											<strong>
												<a
													href={`${timingAdminURL(item.tmdbId, season ?? undefined, episode ?? "episode")}#timing-editor`}
												>
													{item.title}
												</a>
											</strong>
											<span class="source">
												{item.year ? `${item.year} · ` : ""}
												{adRequestStatus[item.status]}
											</span>
										</div>
									</div>
									<div>
										{check ? (
											<span class="source">
												下次检查{" "}
												<time datetime={check}>
													{check.slice(0, 16).replace("T", " ")} UTC
												</time>
											</span>
										) : null}
									</div>
								</li>
							);
						})}
					</ul>
				) : (
					<p class="source">本页暂无广告提交。</p>
				)}
				{page > 1 || list.nextPage ? (
					<nav class="ad-request-pages" aria-label="提交分页">
						{page > 1 ? (
							<a class="button" href={`${adRequestsPath}?page=${page - 1}`}>
								上一页
							</a>
						) : null}
						<span class="source">第 {page} 页</span>
						{list.nextPage ? (
							<a
								class="button"
								href={`${adRequestsPath}?page=${list.nextPage}`}
							>
								下一页
							</a>
						) : null}
					</nav>
				) : null}
			</section>
		</TimingLayout>
	);
}

export function TimingMembersPage({
	actor,
	members,
	audit,
	status,
}: {
	actor: TimingActor;
	members: Member[];
	audit: AuditEntry[];
	status?: string;
}) {
	const path = `${timingAdminPath}/members`;
	const inviteURL = `https://api.eplayerx.com${timingAdminPath}`;
	const message =
		status && Object.hasOwn(memberFeedback, status)
			? memberFeedback[status]
			: undefined;
	return (
		<TimingLayout actor={actor} page="members">
			<div class="page-head">
				<h1>成员管理</h1>
			</div>
			<div class="members-grid">
				<section class="card member-card">
					<h2>邀请编辑者</h2>
					<form class="member-form" method="post" action={path}>
						<label for="member-email">邮箱</label>
						<div class="member-fields">
							<input
								id="member-email"
								type="email"
								name="email"
								placeholder="name@example.com"
								maxlength={254}
								required
							/>
							<button
								class="button primary"
								type="submit"
								name="action"
								value="invite"
							>
								创建邀请
							</button>
						</div>
					</form>
					<div class="member-form">
						<label for="invite-link">登录链接</label>
						<div class="member-fields">
							<input id="invite-link" value={inviteURL} readonly />
							<button class="button" type="button" id="copy-invite">
								复制链接
							</button>
						</div>
					</div>
					<p class="source" id="invite-result" role="status">
						{message}
					</p>
				</section>
				<section class="card member-card">
					<h2>
						成员 <span class="source">{members.length + 1} 人</span>
					</h2>
					<ul class="member-list">
						<li>
							<div>
								<strong>{actor.email}</strong>
								<span class="source">所有者</span>
							</div>
						</li>
						{members.map((member) => (
							<li>
								<div>
									<strong>{member.email}</strong>
									<span class="source">
										编辑者 · {member.joinedAt === null ? "待加入" : "已加入"}
									</span>
								</div>
								<form method="post" action={path} data-remove-member>
									<input type="hidden" name="email" value={member.email} />
									<button
										class="quiet"
										type="submit"
										name="action"
										value="remove"
									>
										移除
									</button>
								</form>
							</li>
						))}
					</ul>
				</section>
				<section class="card member-card audit-card">
					<h2>操作记录</h2>
					{audit.length ? (
						<ol class="member-list audit-list">
							{audit.map((entry) => {
								const time = new Date(entry.createdAt * 1000).toISOString();
								return (
									<li>
										<div>
											<strong>
												{auditLabels[entry.action]} · {entry.subject}
											</strong>
											<span class="source">{entry.email}</span>
											{entry.details ? (
												<details class="audit-details">
													<summary>保存内容</summary>
													<code>{entry.details}</code>
												</details>
											) : null}
										</div>
										<time class="source" datetime={time}>
											{time.slice(0, 16).replace("T", " ")} UTC
										</time>
									</li>
								);
							})}
						</ol>
					) : (
						<p class="source">暂无操作记录。</p>
					)}
				</section>
			</div>
			<script>{raw(memberClient)}</script>
		</TimingLayout>
	);
}

const memberClient = `
document.querySelector("#copy-invite").addEventListener("click", async () => {
	const input = document.querySelector("#invite-link");
	const status = document.querySelector("#invite-result");
	try {
		await navigator.clipboard.writeText(input.value);
		status.textContent = "链接已复制";
	} catch {
		input.select();
		status.textContent = "请复制选中的登录链接";
	}
});
for (const form of document.querySelectorAll("[data-remove-member]")) {
	form.addEventListener("submit", (event) => {
		if (!confirm("移除后，该成员将立即失去编辑权限。")) event.preventDefault();
	});
}
`;

const client = `
const episodeList = document.querySelector(".episode-list");
const selectedEpisode = episodeList?.querySelector('[aria-current="page"]');
if (selectedEpisode) {
	const list = episodeList.getBoundingClientRect();
	const item = selectedEpisode.getBoundingClientRect();
	if (item.left < list.left || item.right > list.right) episodeList.scrollLeft += item.left - list.left;
	if (item.top < list.top || item.bottom > list.bottom) episodeList.scrollTop += item.top - list.top;
}
const editor = document.querySelector("#timing-editor");
if (editor?.querySelector(".save")) {
	const save = editor.querySelector(".save");
	const status = editor.querySelector("#save-result");
	const formBody = () => {
		const body = new URLSearchParams(new FormData(editor));
		if (body.get("adMode") !== "range") {
			body.delete("adStart");
			body.delete("adEnd");
		}
		return body;
	};
	let saved = formBody().toString();
	let saving = false;
	const warnOnExit = (event) => {
		event.preventDefault();
		event.returnValue = true;
	};
	const syncSave = () => {
		const dirty = formBody().toString() !== saved;
		save.disabled = saving || !dirty;
		if (dirty) window.addEventListener("beforeunload", warnOnExit);
		else window.removeEventListener("beforeunload", warnOnExit);
		return dirty;
	};
	const setStatus = (state, message) => {
		status.dataset.state = state;
		status.textContent = message;
	};
	const field = (name) => editor.elements.namedItem(name);
	const parse = (text) => {
		text = (text || "").normalize("NFKC").trim();
		if (!/^\\d{1,5}(?::[0-5]?\\d){0,2}(?:\\.\\d{1,3})?$/.test(text)) return NaN;
		return Math.round(text.split(":").reduce((sum, part) => sum * 60 + Number(part), 0) * 1000);
	};
	const timeline = editor.querySelector("[data-timeline]");
	const drawTimeline = () => {
		if (!timeline) return;
		const total = parse(field("duration").value);
		const known = total > 0;
		timeline.dataset.empty = String(!known);
		timeline.querySelector(".total").textContent = known ? field("duration").value.trim() : "未填写时长";
		for (const seg of timeline.querySelectorAll(".seg")) {
			const kind = seg.dataset.kind;
			const start = parse(field(kind + "Start").value);
			const end = Math.min(parse(field(kind + "End").value), total);
			const shown = known && start < end && (kind !== "ad" || field("adMode").value === "range");
			seg.hidden = !shown;
			if (shown) {
				seg.style.left = (start / total) * 100 + "%";
				seg.style.width = Math.max(((end - start) / total) * 100, 0.6) + "%";
			}
		}
	};
	const onEdit = () => {
		editor.querySelector('[aria-invalid="true"]')?.removeAttribute("aria-invalid");
		drawTimeline();
		const dirty = syncSave();
		if (!saving) setStatus("", dirty ? "有未保存的修改" : "");
	};
	syncSave();
	drawTimeline();
	editor.addEventListener("input", onEdit);
	for (const button of editor.querySelectorAll("[data-duration]")) {
		button.addEventListener("click", () => {
			field("duration").value = button.dataset.duration;
			onEdit();
		});
	}
	for (const button of editor.querySelectorAll("[data-time-pair]")) {
		button.addEventListener("click", () => {
			const start = editor.elements.namedItem(button.dataset.timePair + "Start");
			start.value = button.dataset.start ?? "";
			editor.elements.namedItem(button.dataset.timePair + "End").value = button.dataset.end ?? "";
			onEdit();
			start.focus();
		});
	}
	editor.addEventListener("submit", async (event) => {
		event.preventDefault();
		if (save.disabled) return;
		const body = formBody();
		saving = true;
		syncSave();
		editor.setAttribute("aria-busy", "true");
		setStatus("pending", "正在保存…");
		try {
			const response = await fetch(editor.action, {
				method: "POST",
				body,
				redirect: "manual",
			});
			if (response.status === 401 || response.type === "opaqueredirect") throw new Error("登录已过期，请重新登录。");
			const result = await response.json().catch(() => ({}));
			if (!response.ok || !result.saved) {
				const field = result.field && editor.elements.namedItem(result.field);
				if (field instanceof HTMLInputElement) {
					field.setAttribute("aria-invalid", "true");
					field.focus();
				}
				throw new Error(result.error || "保存失败，请重试。");
			}
			if (body.get("scope") === "series") {
				document.querySelector("#series-ad-free").hidden = body.get("adMode") !== "none";
			}
			if (result.duration != null) {
				let original = field("originalDuration");
				if (!original) {
					original = Object.assign(document.createElement("input"), { type: "hidden", name: "originalDuration" });
					editor.append(original);
				}
				original.value = result.duration;
				body.set("originalDuration", result.duration);
			}
			saved = body.toString();
			if (syncSave()) setStatus("", "有未保存的修改");
			else setStatus("saved", "已保存");
		} catch (error) {
			setStatus("error", error.message || "保存失败，请重试。");
		} finally {
			saving = false;
			syncSave();
			editor.removeAttribute("aria-busy");
		}
	});
}
`;

const styles = `
:root{
 color-scheme:dark;--bg:#05070b;--panel:#0b1017;--card:#0f151d;--control:#070b10;--hover:#161e28;
 --line:#ffffff12;--line-strong:#ffffff21;--ink:#eef3f7;--muted:#8d9aa8;--faint:#5f6b78;
 --brand-a:#bbff9d;--brand-b:#00f4ff;--brand:linear-gradient(120deg,var(--brand-a),var(--brand-b));
 --intro:#5ef0c4;--outro:#a99bff;--ad:#ffc46b;--time:#00f4ff;--danger:#ff8a9a;--ok:#9ff0b8;
 --ease:cubic-bezier(.23,1,.32,1);--mono:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace;
 font:15px/1.55 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI","PingFang SC","Microsoft YaHei",sans-serif
}
*{box-sizing:border-box}
html{background:var(--bg)}
body{margin:0;min-height:100vh;color:var(--ink);-webkit-font-smoothing:antialiased;
 background:radial-gradient(900px 460px at 8% -12%,#00f4ff17,transparent 62%),radial-gradient(760px 420px at 96% -10%,#bbff9d12,transparent 60%),var(--bg) no-repeat}
a{color:inherit;text-decoration:none}
button,input,select{font:inherit;color:inherit}
button,summary,select{cursor:pointer}
h1,h2,h3,p{margin:0}
svg{width:1.1rem;height:1.1rem;flex:none}
:focus-visible{outline:2px solid var(--brand-b);outline-offset:2px;border-radius:8px}
::selection{background:#00f4ff40}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.shell{width:min(1280px,calc(100% - 56px));margin:0 auto}

/* top bar */
.topbar{position:sticky;top:0;z-index:20;background:#05070bc7;backdrop-filter:saturate(1.6) blur(18px);-webkit-backdrop-filter:saturate(1.6) blur(18px);border-bottom:1px solid var(--line)}
.topbar-inner{display:flex;justify-content:space-between;align-items:center;min-height:62px;gap:14px}
.brand{display:inline-flex;align-items:center;gap:10px;font-size:1.05rem;font-weight:760;letter-spacing:-.03em;white-space:nowrap}
.brand-icon{width:34px;height:34px;padding:3px;border-radius:10px;background:#0f1a20;box-shadow:inset 0 0 0 1px #ffffff1a,0 6px 20px -8px #00f4ff80}
.topbar nav{display:flex;align-items:center;gap:2px;padding:4px;border:1px solid var(--line);border-radius:12px;background:#ffffff06;font-size:.84rem;color:var(--muted)}
.topbar nav a{display:flex;align-items:center;min-height:34px;padding:0 13px;border-radius:9px;white-space:nowrap;transition:color .15s,background .15s}
.topbar nav a:hover{color:var(--ink);background:#ffffff0a}
.topbar nav a[aria-current]{color:var(--ink);background:#ffffff14;box-shadow:inset 0 0 0 1px #ffffff14}
.topbar nav a[href$="logout"]{margin-left:4px;color:var(--faint)}

main.shell{padding:30px 0 64px}
.page-head{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:24px}
h1{font-size:clamp(1.55rem,3vw,2.05rem);font-weight:760;letter-spacing:-.04em;line-height:1.15}

/* controls */
.button,.quiet{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:36px;padding:0 14px;border:1px solid var(--line-strong);border-radius:10px;background:#ffffff08;font-size:.86rem;font-weight:560;white-space:nowrap;transition:background .15s var(--ease),border-color .15s,transform .12s var(--ease)}
.button:hover,.quiet:hover{background:#ffffff12;border-color:#ffffff2e}
.button:active,.quiet:active{transform:scale(.97)}
.primary{min-height:42px;padding:0 18px;border:0;background:var(--brand);color:#03130d;font-weight:720;box-shadow:0 10px 28px -12px #00f4ffb3,inset 0 1px 0 #ffffff80}
.primary:hover{background:var(--brand);filter:brightness(1.07)}
.primary:disabled{filter:grayscale(.75) brightness(.55);box-shadow:none;cursor:default;transform:none}
input,select{outline:0}
.time-pair input,.jump input,.season-picker select,.member-fields input,.duration-input input{display:block;width:100%;min-height:42px;padding:0 12px;border:1px solid var(--line-strong);border-radius:10px;background:var(--control);color:var(--ink);font-size:.95rem;transition:border-color .15s,box-shadow .15s}
.time-pair input:hover,.duration-input input:hover,.member-fields input:hover{border-color:#ffffff33}
.time-pair input:focus,.jump input:focus,.season-picker select:focus,.member-fields input:focus,.duration-input input:focus{border-color:var(--tone,var(--brand-b));box-shadow:0 0 0 4px color-mix(in srgb,var(--tone,var(--brand-b)) 18%,transparent)}
[aria-invalid="true"]{border-color:var(--danger)!important;box-shadow:0 0 0 4px #ff8a9a26!important}
.search{display:flex;align-items:center;gap:10px;width:min(440px,100%);padding:5px 5px 5px 14px;border:1px solid var(--line-strong);border-radius:13px;background:#ffffff07;color:var(--muted);transition:border-color .15s,box-shadow .15s}
.search:focus-within{border-color:var(--brand-b);box-shadow:0 0 0 4px #00f4ff1f}
.search input{flex:1;min-width:0;padding:6px 0;border:0;background:none}
.search input::placeholder{color:var(--faint)}
.source,.hint,.editor-note,.time-format,.list-head span{color:var(--muted);font-size:.82rem}
.source{margin-top:8px;overflow-wrap:anywhere}
.error{margin-bottom:18px;padding:12px 14px;border:1px solid #ff8a9a40;border-radius:12px;background:#ff8a9a12;color:var(--danger)}

/* workspace */
.work-grid{display:grid;grid-template-columns:300px minmax(0,1fr);grid-template-areas:"hero hero" "library editor";gap:22px;align-items:start}
.series-hero{grid-area:hero;position:relative;isolation:isolate;overflow:hidden;display:flex;align-items:flex-end;gap:24px;min-height:248px;padding:28px;border:1px solid var(--line);border-radius:24px;background:linear-gradient(135deg,#0e2027,#0b1017 60%)}
.series-hero::before{content:"";position:absolute;z-index:-1;inset:0;background:linear-gradient(90deg,#05070bf2 0%,#05070bb3 38%,#05070b26 100%),linear-gradient(0deg,#05070bf0,transparent 70%)}
.series-hero::after{content:"";position:absolute;z-index:-1;inset:0;border-radius:inherit;box-shadow:inset 0 1px 0 #ffffff14}
.backdrop{position:absolute;z-index:-2;inset:0;display:block}
.backdrop img{display:block;width:100%;height:100%;object-fit:cover;object-position:center 30%}
.poster{width:72px;aspect-ratio:2/3;object-fit:cover;border-radius:10px;flex:none;background:#17212b;color:var(--faint)}
.poster-fallback{display:grid;place-items:center}
.poster-fallback svg{width:24px;height:24px}
.series-hero>.poster{width:112px;border-radius:14px;box-shadow:0 18px 40px -12px #000000e6,0 0 0 1px #ffffff26}
.series-copy{min-width:0;max-width:720px}
.eyebrow{display:inline-flex;margin-bottom:8px;padding:3px 9px;border:1px solid #ffffff1f;border-radius:999px;background:#05070b80;color:#c8d4de;font:600 .7rem/1.4 var(--mono);letter-spacing:.06em}
.series-hero h2{font-size:clamp(1.7rem,3.8vw,2.75rem);font-weight:780;line-height:1.1;letter-spacing:-.045em;overflow-wrap:anywhere;text-shadow:0 2px 24px #0009}
.badge{display:inline-flex;align-items:center;gap:6px;margin-top:12px;padding:4px 10px;border:1px solid #9ff0b84d;border-radius:999px;background:#9ff0b81a;color:var(--ok);font-size:.75rem;font-weight:650}
.badge::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;box-shadow:0 0 8px currentColor}
.badge[hidden]{display:none}

/* library */
.library{grid-area:library;position:sticky;top:84px;display:flex;flex-direction:column;min-width:0;max-height:calc(100vh - 104px);padding:14px;border:1px solid var(--line);border-radius:20px;background:var(--panel)}
.library-title{margin:2px 4px 10px;color:var(--faint);font-size:.72rem;font-weight:650;letter-spacing:.1em}
.season-picker{display:flex;gap:6px;margin-bottom:8px}
.season-picker select{flex:1;min-width:0;min-height:38px;appearance:none;padding-right:30px;background:var(--control) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238d9aa8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 10px center/14px}
.season-picker .quiet{min-height:38px}
.scope-links{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;border:1px solid var(--line);border-radius:12px;background:var(--control)}
.series-link{display:grid;place-items:center;min-height:34px;padding:4px;border-radius:8px;color:var(--muted);font-size:.8rem;font-weight:600;text-align:center;transition:background .15s,color .15s}
.series-link:hover{color:var(--ink);background:#ffffff0a}
.series-link[aria-current]{color:var(--ink);background:#ffffff14;box-shadow:inset 0 0 0 1px #ffffff1a}
.list-head{display:flex;justify-content:space-between;align-items:baseline;margin:16px 4px 8px}
.list-head h2{color:var(--faint);font-size:.72rem;font-weight:650;letter-spacing:.1em}
.episode-list{display:flex;flex-direction:column;gap:2px;min-height:0;margin:0 -6px;padding:0 6px;overflow:auto;scrollbar-width:thin;scrollbar-color:#ffffff1f transparent}
.episode-list a{position:relative;display:grid;grid-template-columns:76px minmax(0,1fr);align-items:center;gap:11px;padding:6px;border-radius:11px;transition:background .15s}
.episode-list a:hover{background:#ffffff0a}
.episode-list a[aria-current]{background:linear-gradient(90deg,#00f4ff1c,#bbff9d0d);box-shadow:inset 0 0 0 1px #00f4ff38}
.episode-list a[aria-current]::before{content:"";position:absolute;left:-6px;top:12px;bottom:12px;width:3px;border-radius:3px;background:var(--brand)}
.episode-still{display:grid;place-items:center;overflow:hidden;aspect-ratio:16/9;border-radius:7px;background:#17212b;color:var(--faint)}
.episode-still img{display:block;width:100%;height:100%;object-fit:cover}
.episode-still svg{width:14px;height:14px}
.episode-caption,.episode-index,.episode-name{display:block;min-width:0}
.episode-index{color:var(--faint);font:600 .68rem/1.3 var(--mono);letter-spacing:.03em}
.episode-list a[aria-current] .episode-index{color:var(--brand-b)}
.episode-name{overflow:hidden;font-size:.84rem;font-weight:560;line-height:1.35;text-overflow:ellipsis;white-space:nowrap}
.jump{margin-top:10px;padding-top:8px;border-top:1px solid var(--line);color:var(--muted);font-size:.8rem}
.jump summary{padding:6px 4px;list-style:none}
.jump summary::-webkit-details-marker{display:none}
.jump summary::before{content:"+ "}
.jump[open] summary::before{content:"− "}
.jump form{display:flex;align-items:end;gap:6px;padding:4px 0 2px}
.jump label{flex:1;min-width:0;font-size:.72rem}
.jump input{min-height:38px;margin-top:3px}

/* editor */
.editor{grid-area:editor;min-width:0;padding:22px;border:1px solid var(--line);border-radius:22px;background:var(--panel);scroll-margin-top:84px}
.editor-heading,.editor-tools{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px 14px}
.editor-title{display:flex;align-items:center;gap:14px;min-width:0}
.editor-still{flex:none;width:96px;height:54px;object-fit:cover;border-radius:10px;background:#17212b;box-shadow:0 0 0 1px #ffffff1a}
.scope{display:block;margin-bottom:3px;color:var(--brand-b);font:600 .74rem/1.4 var(--mono);letter-spacing:.04em}
.editor-heading h2{font-size:clamp(1.3rem,2.4vw,1.65rem);font-weight:740;line-height:1.2;letter-spacing:-.03em;overflow-wrap:anywhere}
.episode-actions{display:flex;flex-wrap:wrap;gap:6px}
.episode-actions .quiet{min-height:34px;padding:0 12px;font-size:.8rem}
.editor-note{margin:14px 0 16px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:#ffffff05}
.editor-tools{margin-bottom:14px}
.marker-links{display:flex;flex-wrap:wrap;gap:6px}
.marker-links a{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 11px;border:1px solid var(--line);border-radius:999px;background:#ffffff05;color:var(--muted);font-size:.8rem;transition:color .15s,border-color .15s}
.marker-links a:hover{color:var(--ink);border-color:var(--line-strong)}
.marker-links svg{width:14px;height:14px}
.marker-links a[href="#timing-intro"] svg{color:var(--intro)}
.marker-links a[href="#timing-outro"] svg{color:var(--outro)}
.marker-links a[href="#timing-ad"] svg{color:var(--ad)}
.time-format{font-family:var(--mono);font-size:.74rem;color:var(--faint)}
.editor-fields{display:grid;gap:12px;min-width:0;margin:0;padding:0;border:0}
.markers{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.card{position:relative;min-width:0;padding:16px;border:1px solid var(--line);border-radius:16px;background:var(--card);scroll-margin-top:84px}
.card.marker::before,.ad-card::before,.duration-card::before{content:"";position:absolute;left:16px;right:16px;top:-1px;height:1px;background:linear-gradient(90deg,transparent,var(--tone),transparent);opacity:.7}
.marker.intro{--tone:var(--intro)}
.marker.outro{--tone:var(--outro)}
.ad-card{--tone:var(--ad);margin:0}
.duration-card{--tone:var(--time)}
.card-head{display:flex;align-items:center;gap:11px;margin-bottom:14px}
.card-head h3{font-size:.98rem;font-weight:680;letter-spacing:-.01em}
.hint{margin-top:1px;font-size:.76rem}
.tile{display:grid;place-items:center;flex:none;width:34px;height:34px;border-radius:10px;color:var(--tone);background:color-mix(in srgb,var(--tone) 13%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--tone) 28%,transparent)}
.tile.intro{--tone:var(--intro)}.tile.outro{--tone:var(--outro)}.tile.ad{--tone:var(--ad)}.tile.duration{--tone:var(--time)}
.clear{min-height:28px;margin-left:auto;padding:0 9px;border-color:transparent;background:transparent;color:var(--muted);font-size:.76rem}
.clear:hover{color:var(--ink)}
.time-pair{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:end;gap:8px}
.time-pair>span{padding-bottom:10px;color:var(--faint)}
.time-pair label{display:block;color:var(--muted);font-size:.72rem;font-weight:560}
.time-pair input{margin-top:5px;font:500 1.02rem/1 var(--mono);font-variant-numeric:tabular-nums;letter-spacing:.02em}
.time-pair input::placeholder,.duration-input input::placeholder{color:#3e4853}
.reference{display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px;margin-top:10px;padding:7px 8px 7px 11px;border-radius:10px;background:#ffffff05;font-size:.78rem}
.reference>span{font-family:var(--mono);font-size:.74rem}
.reference .clear{margin-left:auto;min-height:26px;border:1px solid color-mix(in srgb,var(--tone,var(--brand-b)) 35%,transparent);border-radius:7px;color:var(--tone,var(--brand-b));font-weight:600}
.reference .clear:hover{background:color-mix(in srgb,var(--tone,var(--brand-b)) 12%,transparent)}
.duration-card .reference .clear{margin-left:0;font-family:var(--mono)}

/* duration + timeline */
.duration-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px}
.duration-input{width:min(200px,100%)}
.duration-input input{min-height:52px;font:600 1.5rem/1 var(--mono);letter-spacing:.02em;font-variant-numeric:tabular-nums}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{display:inline-flex;align-items:center;min-height:30px;padding:0 11px;border:1px solid var(--line-strong);border-radius:999px;color:var(--muted);font:500 .78rem/1 var(--mono);transition:color .15s,border-color .15s,background .15s}
.chip:hover{color:var(--ink);border-color:#ffffff33}
.chip[aria-current]{color:var(--time);border-color:#00f4ff66;background:#00f4ff14}
.chip.add{font-family:inherit}
.timeline{margin-top:16px}
.track{position:relative;height:30px;overflow:hidden;border-radius:9px;background:repeating-linear-gradient(90deg,#ffffff0d 0 1px,transparent 1px 10%),#070b10;box-shadow:inset 0 0 0 1px var(--line-strong)}
.seg{position:absolute;top:5px;bottom:5px;min-width:3px;border-radius:5px;background:var(--tone);box-shadow:0 0 16px -2px var(--tone);transition:left .25s var(--ease),width .25s var(--ease)}
.seg[hidden]{display:none}
.seg.intro{--tone:var(--intro)}.seg.outro{--tone:var(--outro)}.seg.ad{--tone:var(--ad)}
.timeline[data-empty="true"] .track::after{content:"填写视频时长后预览时间轴";position:absolute;inset:0;display:grid;place-items:center;color:var(--faint);font-size:.76rem}
.ticks{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:7px;color:var(--faint);font:.72rem/1.3 var(--mono)}
.legend{display:flex;gap:12px}
.legend b{display:inline-flex;align-items:center;gap:5px;font-weight:500}
.legend b::before{content:"";width:8px;height:8px;border-radius:3px;background:var(--tone)}
.legend .intro{--tone:var(--intro)}.legend .outro{--tone:var(--outro)}.legend .ad{--tone:var(--ad)}

/* ad */
.choices{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;padding:4px;border:1px solid var(--line);border-radius:12px;background:var(--control)}
.choices label{display:flex;align-items:center;justify-content:center;gap:7px;min-height:38px;padding:4px 8px;border-radius:9px;color:var(--muted);font-size:.84rem;font-weight:560;text-align:center;cursor:pointer;transition:background .15s,color .15s}
.choices label:hover{color:var(--ink)}
.choices label:has(:checked){color:var(--ink);background:color-mix(in srgb,var(--ad) 14%,#ffffff08);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ad) 40%,transparent)}
.choices input{position:absolute;opacity:0;pointer-events:none}
.choices label:has(:focus-visible){outline:2px solid var(--ad);outline-offset:1px}
.ad-fields,.no-ads-note,.inherit-note{display:none}
.ad-card:has([value="range"]:checked) .ad-fields{display:block;max-width:420px;margin-top:14px}
.ad-card:has([value="none"]:checked) .no-ads-note,.ad-card:has([value="inherit"]:checked) .inherit-note{display:block}

/* save bar */
.savebar{position:sticky;bottom:16px;z-index:5;display:flex;align-items:center;justify-content:flex-end;gap:12px;margin-top:16px;padding:10px 10px 10px 16px;border:1px solid var(--line-strong);border-radius:16px;background:#0b1017e0;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 20px 40px -18px #000}
.savebar p{display:flex;align-items:center;gap:8px;margin-right:auto;color:var(--muted);font-size:.84rem}
.savebar p:not(:empty)::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--ad)}
.savebar p[data-state="pending"]::before{background:var(--brand-b);animation:pulse 1s infinite}
.savebar p[data-state="saved"]{color:var(--ok)}.savebar p[data-state="saved"]::before{background:var(--ok)}
.savebar p[data-state="error"]{color:var(--danger)}.savebar p[data-state="error"]::before{background:var(--danger)}
.editor[aria-busy] .save{cursor:progress}
@keyframes pulse{50%{opacity:.3}}

/* search / empty */
.search-results h2{margin-bottom:14px;color:var(--faint);font-size:.74rem;font-weight:650;letter-spacing:.1em}
.result-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,160px),1fr));gap:14px}
.result{display:grid;align-content:start;gap:10px;padding:8px;overflow-wrap:anywhere;transition:transform .2s var(--ease),border-color .2s,background .2s}
.result:hover{transform:translateY(-3px);border-color:#00f4ff4d;background:var(--hover)}
.result .poster{width:100%;border-radius:10px}
.result div:not(.poster){min-width:0;padding:0 4px 4px}
.result strong{display:block;font-size:.92rem;line-height:1.35}
.result span{display:block;margin-top:3px;color:var(--faint);font:.74rem var(--mono)}
.empty{display:grid;justify-items:center;gap:6px;padding:64px 20px;border:1px dashed var(--line-strong);border-radius:22px;background:#ffffff04;text-align:center}
.empty h1,.empty h2{font-size:1.15rem;letter-spacing:-.02em}
.empty p{max-width:420px;color:var(--muted)}
.empty .button{margin-top:12px}
.editor.empty{border-style:dashed}
.landing{padding:clamp(70px,12vw,150px) 20px;border-style:solid;border-color:var(--line);background:radial-gradient(ellipse 50% 70% at 50% 0%,#00f4ff14,transparent 70%),var(--panel)}
.landing-mark{margin-bottom:14px;padding:8px;border-radius:22px;background:#0f1a20;box-shadow:inset 0 0 0 1px #ffffff1a,0 20px 50px -16px #00f4ff80}
.landing h2{font-size:clamp(1.3rem,3vw,1.8rem);font-weight:760;letter-spacing:-.035em}

/* members / ad requests */
.members-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:16px;align-items:start}
.member-card{padding:20px;border-radius:20px;background:var(--panel)}
.member-card h2{display:flex;align-items:baseline;gap:8px;margin-bottom:14px;font-size:1rem;font-weight:700;letter-spacing:-.01em}
.member-card h2 .source{margin:0;font-weight:500}
.member-form{margin-bottom:14px}
.member-form label{display:block;margin-bottom:6px;color:var(--muted);font-size:.78rem;font-weight:560}
.member-fields{display:flex;gap:8px}
.member-fields input{flex:1;min-width:0}
.member-fields input[readonly]{color:var(--muted);font-family:var(--mono);font-size:.82rem}
.member-fields .button{min-height:42px}
.member-list{margin:0;padding:0;list-style:none}
.member-list li{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 4px;border-top:1px solid var(--line);overflow-wrap:anywhere}
.member-list li:first-child{border-top:0}
.member-list li .source{display:block;margin:2px 0 0;font-size:.76rem}
.member-list strong{font-size:.9rem;font-weight:600}
.member-list .quiet{min-height:30px;color:var(--danger);border-color:#ff8a9a33}
.member-list .quiet:hover{background:#ff8a9a14}
.audit-card{grid-column:1/-1}
.audit-list li{align-items:flex-start}
.audit-list time{flex:none;font-family:var(--mono);font-size:.74rem}
.audit-details{margin-top:6px;color:var(--muted);font-size:.76rem}
.audit-details code{display:block;margin-top:6px;padding:8px 10px;border-radius:8px;background:var(--control);font:.74rem/1.5 var(--mono);white-space:pre-wrap;word-break:break-all}
.ad-request-list li{flex-wrap:wrap;padding:12px 4px}
.ad-request-list a:hover{color:var(--brand-b)}
.ad-request-show{display:flex;align-items:center;gap:12px}
.ad-request-show img{border-radius:6px;object-fit:cover;box-shadow:0 0 0 1px #ffffff1a}
.ad-request-list time{font-family:var(--mono)}
.ad-request-pages{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:14px;padding-top:14px;border-top:1px solid var(--line)}

@media(max-width:980px){
 .shell{width:calc(100% - 32px)}
 .work-grid{grid-template-columns:250px minmax(0,1fr);gap:16px}
 .markers{grid-template-columns:1fr}
}
@media(max-width:700px){
 .shell{width:calc(100% - 24px)}
 .topbar-inner{min-height:56px}.brand span{display:none}
 .topbar nav{overflow-x:auto;scrollbar-width:none}.topbar nav a{padding:0 10px}
 main.shell{padding-top:18px}
 .page-head{flex-direction:column;align-items:stretch;gap:12px;margin-bottom:16px}.search{width:100%}
 .work-grid{grid-template-columns:minmax(0,1fr);grid-template-areas:"hero" "library" "editor";gap:12px}
 .series-hero{min-height:170px;padding:16px;gap:14px;border-radius:18px}.series-hero>.poster{width:76px}
 .library{position:static;max-height:none;padding:12px}
 .episode-list{flex-direction:row;margin:0;padding:2px 0 6px}
 .episode-list a{flex:0 0 150px;grid-template-columns:1fr;gap:6px}
 .episode-list a[aria-current]::before{display:none}
 .editor{padding:14px;border-radius:18px}.editor-still{width:72px;height:41px}
 .choices{grid-template-columns:1fr}
 .savebar{bottom:max(10px,env(safe-area-inset-bottom))}
 .members-grid{grid-template-columns:minmax(0,1fr)}
 .audit-list li{flex-wrap:wrap}.audit-list time{width:100%}
 .result-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
 .button,.quiet,.time-pair input,.choices label{min-height:44px}
 .legend{display:none}
}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{transition:none!important;animation:none!important}}
`;

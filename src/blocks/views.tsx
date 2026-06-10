/** @jsxImportSource hono/jsx */
/**
 * Server-rendered pages for the EplayerX Blocks portal.
 * Dark, modern UI built with hono/jsx + a little vanilla JS (no build step).
 */

import { raw } from "hono/html";
import {
	type BlockCategory,
	DEFAULT_LANGUAGE,
	type DisplayBlock,
	type SubmissionRow,
	TMDB_LANGUAGES,
} from "./types.js";

// Brand logo (EplayerX), vectorized so it needs no static-file hosting.
const LOGO_SVG = `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="exg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#93F9A6"/><stop offset="1" stop-color="#16E0D4"/></linearGradient></defs><g fill="url(#exg)"><rect x="205" y="170" width="600" height="206" rx="103" transform="rotate(-7 505 273)"/><rect x="150" y="455" width="345" height="180" rx="90"/><path d="M566 452 L694 516 L602 606 Z" fill="url(#exg)" stroke="url(#exg)" stroke-width="46" stroke-linejoin="round"/><rect x="282" y="650" width="600" height="206" rx="103" transform="rotate(-7 582 753)"/></g></svg>`;

const STYLES = `
:root{--bg:#080a0f;--card:#13171f;--card2:#1b212d;--line:#252d3c;--fg:#eaeef6;--mut:#8b94a7;--b1:#4be08f;--b2:#16e0d4;--acc:#16e0d4;--acc2:#4be08f;--danger:#ff6b6b;--grad:linear-gradient(120deg,#4be08f,#16e0d4)}
*{box-sizing:border-box}
body{margin:0;color:var(--fg);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;background:var(--bg);background-image:radial-gradient(900px 480px at 78% -8%,rgba(22,224,212,.12),transparent 60%),radial-gradient(760px 420px at 8% 2%,rgba(75,224,143,.10),transparent 55%);background-attachment:fixed;-webkit-tap-highlight-color:transparent}
a{color:var(--acc);text-decoration:none}
.wrap{max-width:900px;margin:0 auto;padding:28px 20px 90px}
.nav{display:flex;gap:20px;align-items:center;padding:14px 22px;border-bottom:1px solid var(--line);position:sticky;top:0;background:rgba(8,10,15,.72);backdrop-filter:blur(14px);z-index:10}
.nav .brand{display:flex;align-items:center;gap:10px;font-weight:700;letter-spacing:.2px;margin-right:6px}
.nav .brand .logo{width:26px;height:26px;display:block;filter:drop-shadow(0 2px 8px rgba(22,224,212,.35))}
.nav .brand .wm{font-size:16px}
.nav .brand .wm b{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.nav .brand .sfx{color:var(--mut);font-weight:600}
.nav a:not(.brand){color:var(--mut);font-size:14px;padding:6px 2px;position:relative}
.nav a.active{color:var(--fg)}
.nav a.active::after{content:"";position:absolute;left:0;right:0;bottom:-15px;height:2px;border-radius:2px;background:var(--grad)}
.nav .spacer{flex:1}
.nav .cta{color:#062a20!important;background:var(--grad);padding:8px 16px!important;border-radius:999px;font-weight:700;font-size:13px}
h1{font-size:26px;margin:26px 0 6px;letter-spacing:-.3px}
.gradtext{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{color:var(--mut);margin:0 0 24px}
.card{background:linear-gradient(180deg,rgba(255,255,255,.02),transparent),var(--card);border:1px solid var(--line);border-radius:18px;padding:22px;margin-bottom:18px;box-shadow:0 12px 36px -20px rgba(0,0,0,.7)}
label{display:block;font-size:13px;color:var(--mut);margin:14px 0 6px}
input,select,textarea{width:100%;background:var(--card2);border:1px solid var(--line);color:var(--fg);border-radius:11px;padding:11px 13px;font-size:14px;transition:border-color .15s,box-shadow .15s;font-family:inherit}
input:focus,select:focus,textarea:focus{outline:none;border-color:var(--b2);box-shadow:0 0 0 3px rgba(22,224,212,.16)}
textarea{min-height:64px;resize:vertical}
code,.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.row{display:flex;gap:12px;flex-wrap:wrap}
.row>div{flex:1;min-width:140px}
.chips{display:flex;gap:8px;flex-wrap:wrap}
.chip{padding:9px 15px;border:1px solid var(--line);border-radius:999px;cursor:pointer;background:var(--card2);font-size:14px;user-select:none;transition:all .15s}
.chip:hover{border-color:#3a4456}
.chip.on{border-color:transparent;color:#062a20;font-weight:600;background:var(--grad)}
.btn{display:inline-flex;align-items:center;gap:8px;background:var(--grad);color:#062a20;border:none;border-radius:11px;padding:12px 20px;font-size:14px;font-weight:700;cursor:pointer;transition:transform .12s,box-shadow .15s,opacity .15s;box-shadow:0 8px 22px -10px rgba(22,224,212,.6)}
.btn:hover{transform:translateY(-1px);box-shadow:0 12px 26px -10px rgba(22,224,212,.75)}
.btn.sec{background:var(--card2);border:1px solid var(--line);color:var(--fg);box-shadow:none}
.btn.danger{background:transparent;border:1px solid var(--danger);color:var(--danger);box-shadow:none}
.btn:disabled{opacity:.5;cursor:not-allowed;transform:none;box-shadow:none}
.hint{font-size:12px;color:var(--mut);margin-top:6px}
.tabs{display:flex;gap:8px;margin:0 0 20px;flex-wrap:wrap}
.tabs .tab{padding:7px 16px;border-radius:999px;border:1px solid var(--line);background:transparent;color:var(--mut);font-size:14px;font-family:inherit;cursor:pointer;transition:color .15s,background .15s}
.tabs .tab:hover{color:var(--fg)}
.tabs .tab.on{border-color:transparent;color:#062a20;font-weight:600;background:var(--grad)}
.hide{display:none!important}
.blk{margin:0 0 6px}
.blk-head{display:flex;align-items:center;gap:6px;padding:20px 4px 12px}
.blk-head .bt{font-size:17px;font-weight:600;color:var(--fg)}
.blk-head .chev{color:var(--mut);font-size:18px;line-height:1;margin-left:-2px}
.blk-head .meta-inline{color:var(--mut);font-size:12px;margin-left:auto;white-space:nowrap}
.scroller{display:flex;overflow-x:auto;padding:2px 0 6px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.scroller::-webkit-scrollbar{display:none}
.it{flex:0 0 auto;padding:0 8px;scroll-snap-align:start}
.it-thumb{width:200px}
.it-poster{width:136px}
.it-hero{width:min(82vw,560px)}
.art{position:relative;border-radius:12px;overflow:hidden;background:var(--card2);transition:transform .18s,filter .18s,box-shadow .18s}
.it:hover .art{transform:scale(1.03);box-shadow:0 10px 28px -12px rgba(0,0,0,.8)}
.art img{width:100%;height:100%;object-fit:cover;display:block}
.art-thumb{width:100%;height:112px}
.art-poster{width:100%;aspect-ratio:2/3}
.art-hero{width:100%;aspect-ratio:16/9;border-radius:16px}
.cap{display:flex;align-items:center;gap:8px;margin-top:8px}
.cap .rk{font-size:30px;font-weight:700;line-height:1;color:rgba(234,238,246,.5);flex:0 0 auto;text-shadow:1px 1px 2px rgba(0,0,0,.3)}
.cap .txt{min-width:0;flex:1}
.t1{font-size:13px;font-weight:500;color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.t2{font-size:11px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.t2.ov{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.35}
.shimmer{background:linear-gradient(100deg,var(--card2) 30%,#222b3a 50%,var(--card2) 70%);background-size:200% 100%;animation:sh 1.3s linear infinite}
@keyframes sh{to{background-position:-200% 0}}
.sk-line{height:11px;border-radius:4px;width:80%}
.prev-empty{color:var(--mut);font-size:13px;padding:16px 8px}
.ph{position:absolute;inset:0;background:linear-gradient(135deg,#222b3a,#141a25)}
.preview-wrap{margin-top:12px;border:1px dashed var(--line);border-radius:12px;padding:10px 0 4px;background:rgba(255,255,255,.015)}
.preview-wrap .scroller{padding-left:8px}
.msg{padding:10px 14px;border-radius:10px;margin:12px 0;font-size:14px;display:none}
.msg.err{background:rgba(255,107,107,.12);color:var(--danger);display:block}
.msg.ok{background:rgba(75,224,143,.14);color:var(--b1);display:block}
.tag{display:inline-block;font-size:12px;color:var(--mut);background:var(--card2);border:1px solid var(--line);border-radius:6px;padding:2px 8px;margin-right:6px}
.tag-official{color:#062a20;font-weight:700;border-color:transparent;background:var(--grad)}
.hide{display:none}
.spin{width:16px;height:16px;border:2px solid rgba(6,42,32,.35);border-top-color:#062a20;border-radius:50%;animation:sp .7s linear infinite;display:inline-block}
@keyframes sp{to{transform:rotate(360deg)}}
.meta{color:var(--mut);font-size:13px;margin-top:6px}
.bllist{display:flex;flex-direction:column;gap:16px}
.bllist .card{margin-bottom:0;transition:transform .15s,border-color .15s}
.bllist .card:hover{border-color:#33405a}
.srcbox{background:var(--card2);border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:12px;color:var(--mut);margin-top:10px;word-break:break-all}
.check{display:flex;align-items:center;gap:8px;color:var(--fg)}
.check input{width:auto}
/* Motion & interaction polish */
@keyframes up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
h1{animation:up .55s .04s cubic-bezier(.22,.68,.3,1) both}
.sub{animation:up .55s .1s cubic-bezier(.22,.68,.3,1) both}
.tabs{animation:up .55s .16s cubic-bezier(.22,.68,.3,1) both}
.blk{opacity:0;transform:translateY(18px);transition:opacity .55s cubic-bezier(.22,.68,.3,1),transform .55s cubic-bezier(.22,.68,.3,1)}
.blk.vis{opacity:1;transform:none}
.scroller.in .it{animation:up .5s cubic-bezier(.22,.68,.3,1) both}
.art img{opacity:0;transition:opacity .45s ease}
.art img.ld{opacity:1}
.blk-head .chev{transition:transform .2s,color .2s}
.blk:hover .chev{transform:translateX(3px);color:var(--acc)}
.it{transition:transform .16s}
.it[data-tid]{cursor:pointer}
.it[data-tid]:hover .t1{color:var(--acc)}
.it[data-tid]:active{transform:scale(.95)}
.it[data-tid]:active .art{filter:brightness(.75)}
.t1{transition:color .15s}
.tabs .tab:active,.chip:active{transform:scale(.94)}
.btn:active{transform:scale(.97)}
.nav .cta{transition:transform .15s,box-shadow .2s}
.nav .cta:hover{transform:translateY(-1px);box-shadow:0 6px 18px -6px rgba(22,224,212,.5)}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important}.blk{opacity:1;transform:none}}
`;

const FAVICON = `data:image/svg+xml,${encodeURIComponent(LOGO_SVG)}`;

// iOS deep-link contract: items open the client's detail screen, matching the
// expo-router route `app/tmdb-info/detail.tsx` (params: id + type).
const APP_STORE_ID = "6747369377";
const DETAIL_PATH = "/tmdb-info/detail";
const UNIVERSAL_LINK_BASE = "https://eplayerx.com";
const APP_SCHEME = "eplayerx";

type NavKey = "explore" | "submit" | "none";

interface LayoutProps {
	title: string;
	active: NavKey;
	children?: unknown;
}

const Layout = ({ title, active, children }: LayoutProps) => (
	<html lang="zh">
		<head>
			<meta charset="utf-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1" />
			<meta name="apple-itunes-app" content={`app-id=${APP_STORE_ID}`} />
			<title>{title} · EplayerX Blocks</title>
			<link rel="icon" href={FAVICON} />
			<style dangerouslySetInnerHTML={{ __html: STYLES }} />
		</head>
		<body>
			<nav class="nav">
				<a href="/blocks" class="brand">
					<span
						class="logo"
						dangerouslySetInnerHTML={{
							__html: raw(LOGO_SVG) as unknown as string,
						}}
					/>
					<span class="wm">
						<b>EplayerX</b> <span class="sfx">Blocks</span>
					</span>
				</a>
				<a href="/blocks" class={active === "explore" ? "active" : ""}>
					社区库
				</a>
				<span class="spacer" />
				<a href="/blocks/submit" class="cta">
					+ 投稿
				</a>
			</nav>
			<div class="wrap">{children}</div>
		</body>
	</html>
);

// MARK: - Community library (home)

const CATEGORY_TABS: { id: BlockCategory | "all"; label: string }[] = [
	{ id: "all", label: "全部" },
	{ id: "movie", label: "电影" },
	{ id: "tv", label: "电视剧" },
	{ id: "anime", label: "动漫" },
];

interface ExploreProps {
	blocks: DisplayBlock[];
	imageBase: string;
	category: BlockCategory | "all";
}

/** Server-rendered shimmer placeholders, replaced by real artwork once data loads. */
const SkeletonRow = ({ preset }: { preset: DisplayBlock["preset"] }) => {
	const isHero = preset === "hero-list";
	const isPoster = preset === "poster-list";
	const count = isHero ? 2 : isPoster ? 6 : 5;
	const artClass = isHero ? "art-hero" : isPoster ? "art-poster" : "art-thumb";
	const itClass = isHero ? "it-hero" : isPoster ? "it-poster" : "it-thumb";
	return (
		<>
			{Array.from({ length: count }).map(() => (
				<div class={`it ${itClass}`}>
					<div class={`art ${artClass} shimmer`} />
					<div class="cap">
						<div class="txt">
							<div class="sk-line shimmer" />
						</div>
					</div>
				</div>
			))}
		</>
	);
};

export const ExplorePage = ({ blocks, imageBase, category }: ExploreProps) => (
	<Layout title="社区库" active="explore">
		<h1 class="gradtext">社区 Blocks</h1>
		<p class="sub">官方默认板块与社区共建板块,挑你喜欢的加进客户端首页。</p>

		<div class="tabs">
			{CATEGORY_TABS.map((t) => (
				<button
					type="button"
					class={`tab${category === t.id ? " on" : ""}`}
					data-cat={t.id}
				>
					{t.label}
				</button>
			))}
		</div>

		{blocks.length === 0 ? (
			<div class="card">
				<p class="meta">这个分类还没有板块,去投稿一个吧。</p>
			</div>
		) : (
			blocks.map((b) => (
				<section
					class={`blk${
						category !== "all" && b.category !== category ? " hide" : ""
					}`}
					data-category={b.category}
					data-src={b.previewSrc}
					data-preset={b.preset}
					data-rank={b.showRank ? "1" : "0"}
					data-ov={b.showOverview ? "1" : "0"}
				>
					<div class="blk-head">
						<span class="bt">{b.title}</span>
						<span class="chev">›</span>
						{b.official ? (
							<span class="tag tag-official">官方</span>
						) : (
							<span class="tag">社区</span>
						)}
						<span class="meta-inline">
							{b.official
								? ""
								: `${b.itemCount ?? 0} 项 · 安装 ${b.installs ?? 0}`}
							{b.author ? ` · @${b.author}` : ""}
						</span>
					</div>
					<div class="scroller">
						<SkeletonRow preset={b.preset} />
					</div>
				</section>
			))
		)}
		<script
			dangerouslySetInnerHTML={{
				__html: raw(exploreJs(imageBase)) as unknown as string,
			}}
		/>
	</Layout>
);

// MARK: - Submit

export const SubmitPage = () => (
	<Layout title="投稿" active="submit">
		<h1 class="gradtext">投稿一个 Block</h1>
		<p class="sub">
			填一个数据源和展示信息,提交后由管理员抓取审核,通过即进社区库。
		</p>

		<div class="card">
			<label>TMDB API Token（必填,投稿凭证,管理员抓取时使用）</label>
			<input id="token" placeholder="以 eyJ 开头的 Read Access Token" />
			<div class="hint">
				提交时会校验有效性。没有的话去
				<a
					href="https://www.themoviedb.org/settings/api"
					target="_blank"
					rel="noreferrer"
				>
					{" "}
					TMDB 申请
				</a>
				。
			</div>

			<label>分类</label>
			<div class="chips" id="category">
				<div class="chip on" data-v="movie">
					电影
				</div>
				<div class="chip" data-v="tv">
					电视剧
				</div>
				<div class="chip" data-v="anime">
					动漫
				</div>
			</div>

			<label>名称</label>
			<input id="title" placeholder="如 高分悬疑剧精选" />

			<label>语言（TMDB 返回标题/简介的语言）</label>
			<select id="language">
				{TMDB_LANGUAGES.map((l) => (
					<option value={l.code} selected={l.code === DEFAULT_LANGUAGE}>
						{l.label}（{l.code}）
					</option>
				))}
			</select>

			<label>榜单地址 / 数据</label>
			<textarea
				id="source"
				class="mono"
				style="min-height:120px"
				placeholder={
					"填一个榜单接口地址,如 /tmdb/trending/movie 或完整 URL\n" +
					'或直接粘贴 JSON 数据,如 [{"id":603,"title":"黑客帝国"}, ...]'
				}
			/>
			<div class="hint">
				只需给一个能拿到榜单的地址,或把整段 JSON
				数据贴进来。抓取与整理由管理员处理。
			</div>

			<label>展示样式</label>
			<div class="chips" id="preset">
				<div class="chip on" data-v="thumb-list">
					横图流
				</div>
				<div class="chip" data-v="poster-list">
					竖图流
				</div>
				<div class="chip" data-v="hero-list">
					大图流
				</div>
			</div>

			<div class="preview-wrap">
				<div class="scroller" id="presetPreview" />
			</div>
			<div class="hint" id="ovNote" style="display:none">
				简介仅在「缩略图流」下展示,海报流/大图流不显示简介。
			</div>

			<div class="row" style="margin-top:6px">
				<div>
					<label class="check">
						<input type="checkbox" id="m_rank" />
						显示排行序号
					</label>
				</div>
				<div>
					<label class="check">
						<input type="checkbox" id="m_overview" />
						显示简介
					</label>
				</div>
			</div>

			<label>署名（可选）</label>
			<input id="m_author" placeholder="昵称,可留空" />

			<div style="margin-top:20px">
				<button class="btn" id="submitBtn" type="button">
					提交审核
				</button>
			</div>
			<div class="msg" id="msg" />
		</div>

		<script
			dangerouslySetInnerHTML={{ __html: raw(SUBMIT_JS) as unknown as string }}
		/>
	</Layout>
);

// MARK: - Admin

export const AdminLoginPage = ({ error }: { error?: boolean }) => (
	<Layout title="审核" active="none">
		<h1 class="gradtext">审核登录</h1>
		<div class="card" style="max-width:420px">
			<form method="post" action="/admin/login">
				<label>管理员密码</label>
				<input type="password" name="password" />
				{error ? <div class="msg err">密码错误</div> : null}
				<div style="margin-top:16px">
					<button class="btn" type="submit">
						登录
					</button>
				</div>
			</form>
		</div>
	</Layout>
);

interface AdminPageProps {
	pending: SubmissionRow[];
}

const ADMIN_CATEGORY_OPTIONS: { value: BlockCategory; label: string }[] = [
	{ value: "movie", label: "电影" },
	{ value: "tv", label: "电视剧" },
	{ value: "anime", label: "动漫" },
];

const ADMIN_PRESET_OPTIONS = [
	{ value: "thumb-list", label: "横图流" },
	{ value: "poster-list", label: "竖图流" },
	{ value: "hero-list", label: "大图流" },
] as const;

export const AdminPage = ({ pending }: AdminPageProps) => (
	<Layout title="审核" active="none">
		<h1 class="gradtext">待审投稿（{pending.length}）</h1>
		<p class="sub">
			先在本地跑发布脚本（scripts/blocks/）抓取并上传 R2,再把输出的 blockId
			填进来;参数可按需修改,点“校验并通过”即发布。
		</p>
		{pending.length === 0 ? (
			<div class="card">
				<p class="meta">暂无待审投稿。</p>
			</div>
		) : (
			<div class="bllist">
				{pending.map((s) => (
					<div class="card" data-id={s.id}>
						<div>
							<strong style="font-size:16px">{s.title}</strong>
							<div class="meta">
								<span class="tag">{s.category}</span>
								<span class="tag">{s.preset}</span>
								<span class="tag">{s.language}</span>
								{s.show_rank ? " · 排行" : ""}
								{s.show_overview ? " · 简介" : ""}
								{s.author ? ` · @${s.author}` : ""}
							</div>
							<div class="meta">{s.created_at}</div>
						</div>
						<div class="srcbox mono">{s.source_spec}</div>
						<label>投稿 ID（发布脚本里填 submissionId,token 会自动读取）</label>
						<div class="srcbox mono">{s.id}</div>
						<label>名称</label>
						<input data-f="title" data-id={s.id} value={s.title} />
						<div class="row">
							<div>
								<label>分类</label>
								<select data-f="category" data-id={s.id}>
									{ADMIN_CATEGORY_OPTIONS.map((o) => (
										<option value={o.value} selected={s.category === o.value}>
											{o.label}
										</option>
									))}
								</select>
							</div>
							<div>
								<label>媒体类型</label>
								<select data-f="mediaType" data-id={s.id}>
									<option value="movie" selected={s.media_type === "movie"}>
										movie
									</option>
									<option value="tv" selected={s.media_type === "tv"}>
										tv
									</option>
								</select>
							</div>
							<div>
								<label>展示样式</label>
								<select data-f="preset" data-id={s.id}>
									{ADMIN_PRESET_OPTIONS.map((o) => (
										<option value={o.value} selected={s.preset === o.value}>
											{o.label}
										</option>
									))}
								</select>
							</div>
						</div>
						<div class="row" style="margin-top:6px">
							<div>
								<label class="check">
									<input
										type="checkbox"
										data-f="showRank"
										data-id={s.id}
										checked={!!s.show_rank}
									/>
									显示排行序号
								</label>
							</div>
							<div>
								<label class="check">
									<input
										type="checkbox"
										data-f="showOverview"
										data-id={s.id}
										checked={!!s.show_overview}
									/>
									显示简介
								</label>
							</div>
							<div>
								<label class="check">
									<input
										type="checkbox"
										data-f="isAnime"
										data-id={s.id}
										checked={!!s.is_anime}
									/>
									动漫标记
								</label>
							</div>
						</div>
						<label>blockId（本地发布脚本输出）</label>
						<input
							class="mono"
							data-f="blockId"
							data-id={s.id}
							placeholder="community-xxxxxxxxxxxx"
						/>
						<div class="hint">
							本地执行 bun run scripts/blocks/&lt;name&gt;.ts 上传快照后,把
							blockId 粘贴到这里。
						</div>
						<div style="margin-top:14px;display:flex;gap:10px">
							<button
								class="btn"
								type="button"
								data-act="approve"
								data-id={s.id}
							>
								校验并通过
							</button>
							<button
								class="btn danger"
								type="button"
								data-act="reject"
								data-id={s.id}
							>
								驳回
							</button>
						</div>
						<div class="msg" data-msg={s.id} />
					</div>
				))}
			</div>
		)}
		<script
			dangerouslySetInnerHTML={{ __html: raw(ADMIN_JS) as unknown as string }}
		/>
	</Layout>
);

// MARK: - Client scripts

function exploreJs(imageBase: string): string {
	return `
const IMG=${JSON.stringify(imageBase)};
function pickList(j){
  if(Array.isArray(j))return j;
  if(j&&typeof j==='object'){
    if(Array.isArray(j.results))return j.results;
    if(Array.isArray(j.data))return j.data;
    for(const v of Object.values(j))if(Array.isArray(v))return v;
  }
  return [];
}
function esc(s){return String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function img(p,sz){return p?(IMG+'/'+sz+p):'';}
function yr(it){const d=it.release_date||it.first_air_date||'';return d?String(d).slice(0,4):'';}
function tt(it){return it.title||it.name||'';}
function pic(u){return u?'<img loading="lazy" src="'+u+'">':'';}
// Deep-link attributes: snapshots carry tmdbId, raw TMDB payloads carry id.
function attrs(it){
  const id=it.tmdbId||it.id;if(!id)return '';
  const mt=it.media_type==='movie'||it.media_type==='tv'?it.media_type:'';
  return ' data-tid="'+id+'"'+(mt?' data-mt="'+mt+'"':'');
}
function cap(it,rankHtml){return '<div class="cap">'+(rankHtml||'')+'<div class="txt"><div class="t1">'+esc(tt(it))+'</div><div class="t2">'+esc(yr(it))+'</div></div></div>';}
function thumb(it,i,rank,ov){
  const u=img(it.thumb||it.backdrop_path||it.poster_path,'w500');
  const rk=rank?'<span class="rk">'+(i+1)+'</span>':'';
  const useOv=!!(ov&&it.overview);
  const sub=useOv?'<div class="t2 ov">'+esc(it.overview)+'</div>':'<div class="t2">'+esc(yr(it))+'</div>';
  return '<div class="it it-thumb"'+attrs(it)+'><div class="art art-thumb">'+pic(u)+'</div><div class="cap">'+rk+'<div class="txt"><div class="t1">'+esc(tt(it))+'</div>'+sub+'</div></div></div>';
}
function poster(it){
  const u=img(it.poster_path||it.thumb||it.backdrop_path,'w342');
  return '<div class="it it-poster"'+attrs(it)+'><div class="art art-poster">'+pic(u)+'</div>'+cap(it)+'</div>';
}
function hero(it){
  const u=img(it.thumb||it.backdrop_path||it.poster_path,'w780');
  return '<div class="it it-hero"'+attrs(it)+'><div class="art art-hero">'+pic(u)+'</div>'+cap(it)+'</div>';
}
const BUILD={'thumb-list':thumb,'poster-list':poster,'hero-list':hero};
// SWR preview cache: keep only the fields the renderers read, capped per row,
// so dozens of blocks stay well under the localStorage quota.
const CK='epx:prev:';
function slim(it){
  return {id:it.tmdbId||it.id,media_type:it.media_type,title:tt(it),
    release_date:it.release_date||it.first_air_date||'',overview:it.overview||'',
    thumb:it.thumb||'',backdrop_path:it.backdrop_path||'',poster_path:it.poster_path||''};
}
function readCache(src){
  try{const v=JSON.parse(localStorage.getItem(CK+src));return Array.isArray(v)&&v.length?v:null;}catch(e){return null;}
}
function render(sc,items,preset,rank,ov,animate){
  const b=BUILD[preset]||thumb;
  sc.innerHTML=items.map((it,i)=>b(it,i,rank,ov)).join('');
  if(animate)Array.from(sc.children).forEach((el,i)=>{el.style.animationDelay=Math.min(i*45,360)+'ms';});
  sc.querySelectorAll('img').forEach(im=>{
    if(im.complete&&im.naturalWidth)im.classList.add('ld');
    else im.addEventListener('load',()=>im.classList.add('ld'),{once:true});
  });
  sc.classList.add('in');
}
// Stale-while-revalidate: paint the cached preview instantly (no skeleton),
// then fetch in the background and only repaint when the data changed.
async function load(sec){
  if(sec.dataset.loaded)return;sec.dataset.loaded='1';
  const sc=sec.querySelector('.scroller');
  const src=sec.dataset.src;const preset=sec.dataset.preset||'thumb-list';
  const rank=sec.dataset.rank==='1';const ov=sec.dataset.ov==='1';
  const cached=readCache(src);
  if(cached)render(sc,cached,preset,rank,ov,false);
  try{
    const r=await fetch(src);if(!r.ok)throw 0;
    const items=pickList(await r.json());if(!items.length)throw 0;
    const max=preset==='hero-list'?8:20;
    const fresh=items.slice(0,max).map(slim);
    const s=JSON.stringify(fresh);
    if(!cached||JSON.stringify(cached)!==s)render(sc,fresh,preset,rank,ov,!cached);
    try{localStorage.setItem(CK+src,s);}catch(e){}
  }catch(e){
    if(cached)return; // stale preview is better than an error
    sc.dataset.loaded='';sec.dataset.loaded='';sc.innerHTML='<div class="prev-empty">预览暂不可用</div>';
  }
}
// Evict cache entries for blocks no longer on the page (all categories are
// always rendered, so data-src is the complete live set).
try{
  const live=new Set(Array.from(document.querySelectorAll('.blk')).map(s=>CK+s.dataset.src));
  for(let i=localStorage.length-1;i>=0;i--){
    const k=localStorage.key(i);
    if(k&&k.indexOf(CK)===0&&!live.has(k))localStorage.removeItem(k);
  }
}catch(e){}
// Lazy-load on scroll; hidden (display:none) sections only load once their tab
// is selected and they enter the viewport.
const io=new IntersectionObserver((es)=>{es.forEach(e=>{if(e.isIntersecting)load(e.target);});},{rootMargin:'400px'});
document.querySelectorAll('.blk').forEach(s=>io.observe(s));
// Reveal-on-scroll: fires again when a hidden section is re-shown by the tabs.
const rio=new IntersectionObserver((es)=>{es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('vis');});},{threshold:.08});
document.querySelectorAll('.blk').forEach(s=>rio.observe(s));
function applyCategory(cat){
  document.querySelectorAll('.tabs .tab').forEach(t=>t.classList.toggle('on',t.dataset.cat===cat));
  document.querySelectorAll('.blk').forEach(s=>{
    const hide=cat!=='all'&&s.dataset.category!==cat;
    // Drop 'vis' when hiding so the reveal animation replays on re-show.
    if(hide)s.classList.remove('vis');
    s.classList.toggle('hide',hide);
  });
  // Keep the tab in the URL so a refresh restores it (server renders ?category=).
  const u=new URL(location.href);
  if(cat==='all')u.searchParams.delete('category');else u.searchParams.set('category',cat);
  history.replaceState(null,'',u);
}
document.querySelectorAll('.tabs .tab').forEach(t=>{t.onclick=()=>applyCategory(t.dataset.cat);});
// Tap a card -> the iOS client's detail screen (app/tmdb-info/detail.tsx).
// Universal links never fire on same-domain taps, so try the custom scheme
// first and fall back to the universal link if the app doesn't take over.
const DETAIL=${JSON.stringify(`${UNIVERSAL_LINK_BASE}${DETAIL_PATH}`)};
const SCHEME=${JSON.stringify(`${APP_SCHEME}:/${DETAIL_PATH}`)};
function openDetail(id,mt){
  const q='?id='+encodeURIComponent(id)+'&type='+(mt||'movie');
  if(/iPad|iPhone|iPod/.test(navigator.userAgent)){
    const t=setTimeout(()=>{location.href=DETAIL+q;},1200);
    addEventListener('pagehide',()=>clearTimeout(t),{once:true});
    location.href=SCHEME+q;
  }else{
    location.href=DETAIL+q;
  }
}
document.querySelectorAll('.blk').forEach(s=>{
  const fallbackMt=s.dataset.category==='movie'?'movie':'tv';
  s.addEventListener('click',e=>{
    const it=e.target.closest('.it');
    if(it&&it.dataset.tid)openDetail(it.dataset.tid,it.dataset.mt||fallbackMt);
  });
});
`;
}

const SUBMIT_JS = `
const $=(s)=>document.querySelector(s);
const state={category:'movie',preset:'thumb-list'};
function chips(id,key,onChange){
  document.querySelectorAll('#'+id+' .chip').forEach(c=>{
    c.onclick=()=>{
      document.querySelectorAll('#'+id+' .chip').forEach(x=>x.classList.remove('on'));
      c.classList.add('on');state[key]=c.dataset.v;
      if(onChange)onChange();
    };
  });
}
const SAMPLE=[
  {t:'流浪地球',y:'2023',g:'科幻',r:'8.9',o:'太阳即将毁灭,人类启动“流浪地球”计划,带着地球逃离太阳系。'},
  {t:'三体',y:'2024',g:'科幻',r:'8.7',o:'物理学家叶文洁向宇宙发出信号,引来三体文明对地球的窥伺。'},
  {t:'繁花',y:'2024',g:'剧情',r:'8.5',o:'上世纪 90 年代的上海,阿宝在时代浪潮中起伏沉沦。'},
  {t:'漫长的季节',y:'2023',g:'悬疑',r:'9.4',o:'一桩旧案牵出东北小城几个家庭长达二十年的纠葛。'},
  {t:'狂飙',y:'2023',g:'犯罪',r:'8.4',o:'刑警安欣与黑恶势力高启强长达二十年的较量。'},
  {t:'去有风的地方',y:'2023',g:'剧情',r:'8.6',o:'许红豆辞职来到云南小村,在有风的地方治愈自己。'}
];
function previewCard(preset,it,i,rank,ov){
  if(preset==='poster-list')
    return '<div class="it it-poster"><div class="art art-poster"><div class="ph"></div></div><div class="cap"><div class="txt"><div class="t1">'+it.t+'</div><div class="t2">'+it.y+'</div></div></div></div>';
  if(preset==='hero-list')
    return '<div class="it it-hero"><div class="art art-hero"><div class="ph"></div></div><div class="cap"><div class="txt"><div class="t1">'+it.t+'</div><div class="t2">'+it.y+' · '+it.g+'</div></div></div></div>';
  const sub=ov?'<div class="t2 ov">'+it.o+'</div>':'<div class="t2">'+it.y+' · '+it.g+'</div>';
  return '<div class="it it-thumb"><div class="art art-thumb"><div class="ph"></div></div><div class="cap">'+(rank?'<span class="rk">'+(i+1)+'</span>':'')+'<div class="txt"><div class="t1">'+it.t+'</div>'+sub+'</div></div></div>';
}
function renderPreview(){
  const box=document.getElementById('presetPreview');if(!box)return;
  const preset=state.preset;const rank=$('#m_rank').checked;const ov=$('#m_overview').checked;
  const note=document.getElementById('ovNote');
  if(note)note.style.display=(ov&&preset!=='thumb-list')?'block':'none';
  const n=preset==='hero-list'?3:6;
  box.innerHTML=SAMPLE.slice(0,n).map((it,i)=>previewCard(preset,it,i,rank,ov)).join('');
}
chips('category','category');chips('preset','preset',renderPreview);
$('#m_rank').addEventListener('change',renderPreview);
$('#m_overview').addEventListener('change',renderPreview);
renderPreview();
// Remember the TMDB token locally so returning submitters don't retype it.
const TOKEN_KEY='eplayerx_tmdb_token';
try{const saved=localStorage.getItem(TOKEN_KEY);if(saved)$('#token').value=saved;}catch(e){}
function show(cls,text){const m=$('#msg');m.className='msg '+cls;m.textContent=text;}
$('#submitBtn').onclick=async()=>{
  const token=$('#token').value.trim();
  const title=$('#title').value.trim();
  const source=$('#source').value.trim();
  if(!token)return show('err','请填写 TMDB Token');
  if(!title)return show('err','请填写名称');
  if(!source)return show('err','请填写榜单地址或粘贴数据');
  const btn=$('#submitBtn');btn.disabled=true;btn.innerHTML='<span class="spin"></span> 提交中…';
  show('','');
  try{
    const r=await fetch('/blocks/submit',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({token,category:state.category,title,preset:state.preset,
        language:$('#language').value,
        showRank:$('#m_rank').checked,showOverview:$('#m_overview').checked,
        author:$('#m_author').value.trim(),source})});
    const j=await r.json();
    if(!r.ok){show('err',j.error||'提交失败');btn.disabled=false;btn.textContent='提交审核';return;}
    try{localStorage.setItem(TOKEN_KEY,token);}catch(e){}
    show('ok','已提交审核,通过后会出现在社区库,感谢投稿!');
    btn.textContent='已提交';
  }catch(e){show('err','网络错误');btn.disabled=false;btn.textContent='提交审核';}
};
`;

const ADMIN_JS = `
function field(id,name){return document.querySelector('[data-f="'+name+'"][data-id="'+id+'"]');}
function fieldVal(id,name){const el=field(id,name);return el?el.value.trim():'';}
function fieldChecked(id,name){const el=field(id,name);return el?el.checked:false;}
document.querySelectorAll('[data-act]').forEach(b=>{
  b.onclick=async()=>{
    const id=b.dataset.id,act=b.dataset.act;
    const msg=document.querySelector('[data-msg="'+id+'"]');
    let reason='';
    if(act==='reject'){reason=prompt('驳回理由?')||'';}
    const payload={reason};
    if(act==='approve'){
      payload.blockId=fieldVal(id,'blockId');
      if(!payload.blockId){msg.className='msg err';msg.textContent='请填写 blockId（先本地运行发布脚本）';return;}
      payload.title=fieldVal(id,'title');
      payload.category=fieldVal(id,'category');
      payload.mediaType=fieldVal(id,'mediaType');
      payload.preset=fieldVal(id,'preset');
      payload.showRank=fieldChecked(id,'showRank');
      payload.showOverview=fieldChecked(id,'showOverview');
      payload.isAnime=fieldChecked(id,'isAnime');
    }
    const card=b.closest('.card');
    card.querySelectorAll('[data-act]').forEach(x=>x.disabled=true);
    if(act==='approve'){b.innerHTML='<span class="spin"></span> 校验中…';}
    try{
      const r=await fetch('/admin/'+id+'/'+act,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload)});
      const j=await r.json();
      if(!r.ok){msg.className='msg err';msg.textContent=j.error||'操作失败';
        card.querySelectorAll('[data-act]').forEach(x=>x.disabled=false);
        if(act==='approve')b.textContent='校验并通过';return;}
      card.style.opacity='.45';
      msg.className='msg ok';
      msg.textContent=act==='approve'?('已通过 · '+(j.itemCount||0)+' 项 · '+(j.blockId||'')):'已驳回';
    }catch(e){msg.className='msg err';msg.textContent='网络错误';
      card.querySelectorAll('[data-act]').forEach(x=>x.disabled=false);
      if(act==='approve')b.textContent='校验并通过';}
  };
});
`;

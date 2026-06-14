/** @jsxImportSource hono/jsx */
/// <reference types="@cloudflare/workers-types" />
/**
 * EplayerX Blocks — public portal + consumption API.
 *
 * `/blocks` is the community library (home). Submitters declare a free-form
 * data source + their TMDB token; the admin scrapes it on approval (see
 * `admin.tsx`). Approved blocks are served to the client unchanged.
 */

import { type Context, Hono } from "hono";
import { createDefaultHomeConfig } from "../home/config.js";
import { isAdmin } from "./admin.js";
import {
	absoluteSourcePath,
	IMAGE_BASE,
	officialHomeBlocksById,
	PUBLIC_API_BASE,
} from "./collections.js";
import { getDb, ServiceUnavailable, shortId } from "./runtime.js";
import { validateToken } from "./scraper.js";
import {
	type CommunityBlockFilter,
	getBlockCollection,
	getCommunityBlocksByIds,
	incrementCollectionInstalls,
	incrementInstalls,
	insertBlockCollection,
	insertSubmission,
	listApprovedBlockCollections,
	listCommunityBlocks,
	listCommunityLanguages,
	publicDataUrl,
} from "./storage.js";
import {
	type BlockCategory,
	type BlockPreset,
	type BlocksBindings,
	COLLECTION_PRESET,
	type CollectionBlock,
	type CommunityBlockRow,
	DEFAULT_LANGUAGE,
	type DisplayBlock,
	type HomeBlock,
	type ImportableBlock,
	type ImportableCollectionBlock,
	type ImportableEntry,
	type MediaType,
	type SnapshotBlob,
	TMDB_LANGUAGES,
} from "./types.js";
import {
	type ExploreCategory,
	ExplorePage,
	HomepageDetailPage,
	type HomepageSummary,
	ImportLandingPage,
	SubmitPage,
} from "./views.js";

const app = new Hono<{ Bindings: BlocksBindings }>();

const VALID_PRESETS: BlockPreset[] = ["thumb-list", "poster-list", "hero-list"];
const VALID_CATEGORIES: BlockCategory[] = ["movie", "tv", "anime"];
const MEDIA_LIST_PRESETS = new Set(VALID_PRESETS);
const VALID_LANGUAGES = new Set(TMDB_LANGUAGES.map((l) => l.code));

const MAX_SOURCE_LEN = 100_000;
const PREVIEW_LIMIT = 20;
const WEB_COMMUNITY_PAGE_SIZE = 50;
const PUBLIC_CACHE_MAX_AGE_SECONDS = 30;
const PUBLIC_CACHE_STALE_SECONDS = 120;

const R2_PUBLIC_BASE = `https://${process.env.R2_CUSTOM_DOMAIN || "assets.eplayerx.com"}`;
const CRAWLER_POPULAR_PREFIX = "/crawler/popular/";

type BlocksContext = Context<{ Bindings: BlocksBindings }>;

function parsePage(value: string | undefined): number {
	const n = Number.parseInt(value || "1", 10);
	return Number.isFinite(n) && n > 0 ? n : 1;
}

function pageHref(currentUrl: string, page: number): string {
	const url = new URL(currentUrl);
	if (page <= 1) {
		url.searchParams.delete("page");
	} else {
		url.searchParams.set("page", String(page));
	}
	return `${url.pathname}${url.search}`;
}

function publicCacheHeader(): string {
	return `public, max-age=${PUBLIC_CACHE_MAX_AGE_SECONDS}, s-maxage=${PUBLIC_CACHE_MAX_AGE_SECONDS}, stale-while-revalidate=${PUBLIC_CACHE_STALE_SECONDS}`;
}

function defaultCache(): Cache | null {
	if (typeof caches === "undefined") return null;
	return (caches as unknown as { default?: Cache }).default ?? null;
}

async function publicCachedGet(
	c: BlocksContext,
	render: () => Response | Promise<Response>,
): Promise<Response> {
	const cache = defaultCache();
	if (isAdmin(c) || c.req.method !== "GET" || !cache) {
		return render();
	}
	const cacheKey = new Request(c.req.url, { method: "GET" });
	const cached = await cache.match(cacheKey);
	if (cached) return cached;
	const response = await render();
	if (response.ok) {
		response.headers.set("Cache-Control", publicCacheHeader());
		c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
	}
	return response;
}

function webCommunityFilter(category: ExploreCategory): CommunityBlockFilter {
	if (VALID_CATEGORIES.includes(category as BlockCategory)) {
		return { category: category as BlockCategory };
	}
	if (category === "collection") return { kind: "collection" };
	return {};
}

/**
 * Build a preview URL from a default block's source. Crawler-popular blocks are
 * static R2 snapshots, so we hit `assets.eplayerx.com` directly instead of
 * proxying through this worker; live TMDB/crawler endpoints use the public API
 * domain because `eplayerx.com` only routes `/blocks*` to this worker.
 */
function previewSrcFromSource(
	source: { path?: string; query?: Record<string, unknown> } | undefined,
): string | null {
	if (!source?.path) return null;
	if (source.path.startsWith(CRAWLER_POPULAR_PREFIX)) {
		const file = source.path
			.slice(CRAWLER_POPULAR_PREFIX.length)
			.replace(/\//g, "-");
		return `${R2_PUBLIC_BASE}/${file}.json`;
	}
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(source.query ?? {})) {
		params.set(key, String(value));
	}
	const qs = params.toString();
	// Collection children carry absolute (frozen) URLs already.
	const base = source.path.startsWith("http")
		? source.path
		: `${PUBLIC_API_BASE}${source.path.startsWith("/") ? source.path : `/${source.path}`}`;
	return qs ? `${base}?${qs}` : base;
}

/**
 * Preview URL for one collection child. Community children point back at
 * this worker (so we can cap the payload); everything else passes through.
 */
function childPreviewSrc(
	source: { path: string; query?: Record<string, unknown> },
	limit = 6,
): string {
	const match = source.path.match(/\/blocks\/data\/([a-zA-Z0-9_-]+)$/);
	if (match) return `/blocks/data/${match[1]}?limit=${limit}`;
	return previewSrcFromSource(source) ?? source.path;
}

function presetForSharedStyle(
	preset: string | undefined,
	style: unknown,
): BlockPreset {
	switch (style) {
		case "poster":
			return "poster-list";
		case "thumb":
			return "thumb-list";
		case "hero":
			return "hero-list";
		default:
			return VALID_PRESETS.includes(preset as BlockPreset)
				? (preset as BlockPreset)
				: "thumb-list";
	}
}

/** Frozen pack entry -> display block for the homepage detail page. */
function importableToDisplay(entry: ImportableEntry): DisplayBlock {
	if (entry.preset === COLLECTION_PRESET) {
		const col = entry as ImportableCollectionBlock;
		const children = col.children ?? [];
		return {
			id: col.id,
			title: col.title,
			category: col.category ?? "tv",
			preset: COLLECTION_PRESET,
			showRank: false,
			showOverview: false,
			previewSrc: children[0] ? childPreviewSrc(children[0].source) : "",
			official: false,
			itemCount: col.itemCount,
			author: col.author,
			language: col.language,
			collectionMode: col.groupMode,
			collectionStyle: col.style,
			collectionChildren: children.map((ch) => ({
				id: ch.id,
				label: ch.label,
				...(ch.weekday ? { weekday: ch.weekday } : {}),
				...(ch.image ? { image: ch.image } : {}),
				previewSrc: childPreviewSrc(ch.source),
			})),
		};
	}
	const hb = entry as ImportableBlock & {
		source?: ImportableBlock["source"];
		preset?: string;
		style?: string;
	};
	const category =
		hb.category ??
		(hb.metadata?.isAnime
			? "anime"
			: hb.mediaType === "movie"
				? "movie"
				: "tv");
	if (SPECIAL_SHARED_PRESETS.has(hb.preset ?? "") || !hb.source?.path) {
		return {
			id: hb.id,
			title: hb.title,
			category,
			preset: "thumb-list",
			showRank: false,
			showOverview: false,
			previewSrc: "",
			official: false,
			itemCount: hb.itemCount,
			author: hb.author,
			language: hb.language,
		};
	}
	return {
		id: hb.id,
		title: hb.title,
		category,
		preset: presetForSharedStyle(hb.preset, hb.style),
		showRank: !!hb.showRank,
		showOverview: !!hb.showOverview,
		previewSrc: childPreviewSrc(hb.source, PREVIEW_LIMIT),
		official: false,
		itemCount: hb.itemCount,
		author: hb.author,
		language: hb.language,
	};
}

/** Built-in default home blocks, surfaced in the library as official entries. */
function officialBlocks(language: string): DisplayBlock[] {
	const cfg = createDefaultHomeConfig({
		apiBaseUrl: "",
		imageBaseUrl: IMAGE_BASE,
		language,
		timezone: "UTC",
	});
	const blocks: DisplayBlock[] = [];
	for (const b of cfg.blocks) {
		if (!b.mediaType || !MEDIA_LIST_PRESETS.has(b.preset as BlockPreset)) {
			continue;
		}
		const previewSrc = previewSrcFromSource(b.source);
		if (!previewSrc) continue;
		blocks.push({
			id: b.id,
			title: b.title ?? b.id,
			category: b.metadata?.isAnime
				? "anime"
				: b.mediaType === "movie"
					? "movie"
					: "tv",
			preset: b.preset as BlockPreset,
			showRank: !!b.showRank,
			showOverview: !!b.showOverview,
			previewSrc,
			official: true,
			language,
		});
	}
	return blocks;
}

function communityToDisplay(row: CommunityBlockRow): DisplayBlock {
	let preset: DisplayBlock["preset"] = "thumb-list";
	let showRank = false;
	let showOverview = false;
	let collection: CollectionBlock | null = null;
	try {
		const hb = JSON.parse(row.block_json) as HomeBlock | CollectionBlock;
		if (hb.preset === COLLECTION_PRESET) {
			collection = hb as CollectionBlock;
			preset = COLLECTION_PRESET;
		} else if (VALID_PRESETS.includes(hb.preset as BlockPreset)) {
			preset = hb.preset;
			showRank = !!(hb as HomeBlock).showRank;
			showOverview = !!(hb as HomeBlock).showOverview;
		}
	} catch {
		// fall back to defaults on malformed JSON
	}
	const children = collection?.children ?? [];
	return {
		id: row.block_id,
		title: row.title,
		category: row.category,
		preset,
		showRank,
		showOverview,
		// Preview only needs the first items; the full snapshot may be huge.
		previewSrc: collection
			? children[0]
				? childPreviewSrc(children[0].source)
				: ""
			: `/blocks/data/${row.block_id}?limit=${PREVIEW_LIMIT}`,
		official: false,
		itemCount: row.item_count,
		installs: row.installs,
		author: row.author,
		language: row.language,
		...(collection
			? {
					collectionMode: collection.groupMode,
					collectionStyle: collection.style,
					collectionChildren: children.map((ch) => ({
						id: ch.id,
						label: ch.label,
						...(ch.weekday ? { weekday: ch.weekday } : {}),
						...(ch.image ? { image: ch.image } : {}),
						previewSrc: childPreviewSrc(ch.source),
					})),
				}
			: {}),
	};
}

// MARK: - Community library (home)

const EXPLORE_CATEGORIES = new Set([
	"movie",
	"tv",
	"anime",
	"collection",
	"homepage",
]);

app.get("/", (c) =>
	publicCachedGet(c, async () => {
		const raw = c.req.query("category");
		const category = (
			EXPLORE_CATEGORIES.has(raw ?? "") ? raw : "all"
		) as ExploreCategory;
		const language = c.req.query("language") || "zh-CN";
		const page = parsePage(c.req.query("page"));
		const offset = (page - 1) * WEB_COMMUNITY_PAGE_SIZE;

		// Render every category up-front; the filter works client-side (instant, no
		// reload, previews fetched once and kept in the DOM).
		let community: CommunityBlockRow[] = [];
		let hasNextPage = false;
		let languages: string[] = [];
		let homepages: HomepageSummary[] = [];
		try {
			const db = getDb(c);
			const shouldListCommunity = category !== "homepage";
			const [rows, langs, pages] = await Promise.all([
				shouldListCommunity
					? listCommunityBlocks(
							db,
							webCommunityFilter(category),
							WEB_COMMUNITY_PAGE_SIZE + 1,
							offset,
						)
					: Promise.resolve([]),
				listCommunityLanguages(db),
				page === 1 ? listApprovedBlockCollections(db) : Promise.resolve([]),
			]);
			hasNextPage = rows.length > WEB_COMMUNITY_PAGE_SIZE;
			community = rows.slice(0, WEB_COMMUNITY_PAGE_SIZE);
			languages = langs;
			homepages = pages.map(homepageSummaryFromRow);
		} catch {
			community = [];
		}

		const blocks: DisplayBlock[] = [
			...(page === 1 && category !== "homepage"
				? officialBlocks(language)
				: []),
			...community.map(communityToDisplay),
		];

		return c.html(
			<ExplorePage
				blocks={blocks}
				imageBase={IMAGE_BASE}
				category={category}
				languages={languages}
				homepages={homepages}
				pagination={{
					page,
					prevHref: page > 1 ? pageHref(c.req.url, page - 1) : undefined,
					nextHref: hasNextPage ? pageHref(c.req.url, page + 1) : undefined,
				}}
				isAdmin={isAdmin(c)}
			/>,
		);
	}),
);

/** Published homepage detail: every contained block, with an install link. */
app.get("/homepages/:collectionId", async (c) => {
	const collectionId = c.req
		.param("collectionId")
		.replace(/[^a-zA-Z0-9_-]/g, "");
	try {
		const row = await getBlockCollection(getDb(c), collectionId);
		if (!row || row.status !== "approved") return c.notFound();
		const entries = parseCollectionEntries(row.blocks_json);
		return c.html(
			<HomepageDetailPage
				homepage={{
					...homepageSummaryFromRow(row),
					blockTitles: entries.map((b) => b.title),
				}}
				blocks={entries.map(importableToDisplay)}
				imageBase={IMAGE_BASE}
			/>,
		);
	} catch (error) {
		if (error instanceof ServiceUnavailable) {
			return c.text("服务暂不可用", 503);
		}
		throw error;
	}
});

/** Published homepages as JSON (client community browser's 首页 filter). */
app.get("/homepages", (c) =>
	publicCachedGet(c, async () => {
		try {
			const rows = await listApprovedBlockCollections(getDb(c));
			const homepages = rows.map(homepageSummaryFromRow);
			return c.json({ version: 1, homepages });
		} catch (error) {
			if (error instanceof ServiceUnavailable) {
				return c.json({ version: 1, homepages: [] });
			}
			throw error;
		}
	}),
);

app.get("/submit", (c) => c.html(<SubmitPage />));

app.post("/submit", async (c) => {
	const body = await c.req.json().catch(() => null);
	const token = typeof body?.token === "string" ? body.token.trim() : "";
	const category = String(body?.category) as BlockCategory;
	const title = String(body?.title || "").trim();
	const preset = String(body?.preset) as BlockPreset;
	const language = String(body?.language || DEFAULT_LANGUAGE);
	const source = typeof body?.source === "string" ? body.source.trim() : "";

	if (!token) return c.json({ error: "缺少 TMDB Token" }, 400);
	if (!VALID_CATEGORIES.includes(category)) {
		return c.json({ error: "分类不合法" }, 400);
	}
	if (!title) return c.json({ error: "请填写名称" }, 400);
	if (!VALID_PRESETS.includes(preset)) {
		return c.json({ error: "展示样式不合法" }, 400);
	}
	if (!VALID_LANGUAGES.has(language)) {
		return c.json({ error: "语言不合法" }, 400);
	}
	if (!source) return c.json({ error: "请填写榜单地址或粘贴数据" }, 400);
	if (source.length > MAX_SOURCE_LEN) {
		return c.json({ error: "数据源内容过长" }, 400);
	}

	if (!(await validateToken(token))) {
		return c.json({ error: "TMDB Token 无效或无权限" }, 400);
	}

	const isAnime = category === "anime";
	const mediaType: MediaType = category === "movie" ? "movie" : "tv";

	try {
		await insertSubmission(getDb(c), {
			id: shortId(),
			category,
			mediaType,
			isAnime,
			title,
			preset,
			showRank: !!body?.showRank,
			showOverview: !!body?.showOverview,
			language,
			source,
			tmdbToken: token,
			author: body?.author ? String(body.author).slice(0, 40) : null,
			createdAt: new Date().toISOString(),
		});
	} catch (error) {
		if (error instanceof ServiceUnavailable) {
			return c.json({ error: error.message }, 503);
		}
		throw error;
	}
	return c.json({ ok: true });
});

// MARK: - Consumption API (for the client)

app.get("/community", (c) =>
	publicCachedGet(c, async () => {
		const raw = c.req.query("category");
		// "collection" is a pseudo-category: it filters by block kind instead of
		// the movie/tv/anime taxonomy (mirrors the explore page's filter chips).
		const filter = {
			category: VALID_CATEGORIES.includes(raw as BlockCategory)
				? (raw as BlockCategory)
				: undefined,
			kind: raw === "collection" ? ("collection" as const) : undefined,
			language: c.req.query("language") || undefined,
			q: c.req.query("q")?.trim() || undefined,
		};
		const limit = Math.min(
			Math.max(Number.parseInt(c.req.query("limit") || "20", 10) || 20, 1),
			50,
		);
		const offset = Math.max(
			Number.parseInt(c.req.query("offset") || "0", 10) || 0,
			0,
		);
		try {
			const db = getDb(c);
			const [rows, languages] = await Promise.all([
				listCommunityBlocks(db, filter, limit + 1, offset),
				offset === 0 ? listCommunityLanguages(db) : Promise.resolve([]),
			]);
			const visibleRows = rows.slice(0, limit);
			const hasMore = rows.length > limit;
			// Older clients only use total to decide hasMore (fetchedCount < total).
			const total = offset + visibleRows.length + (hasMore ? 1 : 0);
			// HomeBlock shape plus browse metadata for the client community browser.
			const blocks = visibleRows.map((r) => ({
				...(JSON.parse(r.block_json) as HomeBlock),
				category: r.category,
				author: r.author,
				installs: r.installs,
				itemCount: r.item_count,
				language: r.language,
			}));
			return c.json({ version: 1, total, languages, blocks });
		} catch (error) {
			if (error instanceof ServiceUnavailable) {
				return c.json({ version: 1, total: 0, languages: [], blocks: [] });
			}
			throw error;
		}
	}),
);

app.get("/data/:blockId", async (c) => {
	const blockId = c.req.param("blockId").replace(/[^a-zA-Z0-9_-]/g, "");
	const limit = Number.parseInt(c.req.query("limit") || "", 10);
	const response = await fetch(publicDataUrl(blockId));
	// Without a limit (the iOS client) stream the snapshot through untouched;
	// the blob carries the block's display title since publish time.
	if (!response.ok || !Number.isFinite(limit) || limit <= 0) {
		return new Response(response.body, {
			status: response.status,
			headers: {
				"Content-Type":
					response.headers.get("Content-Type") || "application/json",
			},
		});
	}
	const blob = (await response.json()) as SnapshotBlob;
	const data = (blob.data ?? []).slice(0, limit);
	return c.json({ ...blob, count: data.length, data });
});

// MARK: - Block collections (shareable bundles, imported via universal link)

const IMPORT_LINK_BASE =
	process.env.IMPORT_LINK_BASE_URL || "https://eplayerx.com/import/blocks";
const MAX_COLLECTION_TITLE_LEN = 40;
const MAX_COLLECTION_BLOCKS = 50;
const VALID_SHARED_STYLES = new Set([
	"poster",
	"thumb",
	"hero",
	"rank",
	"banner",
	"image",
]);
const SPECIAL_SHARED_PRESETS = new Set([
	"genres-list",
	"languages-list",
	"networks-list",
]);

function parseCollectionEntries(blocksJson: string): ImportableEntry[] {
	const parsed = JSON.parse(blocksJson) as
		| ImportableEntry[]
		| { blocks?: ImportableEntry[] };
	if (Array.isArray(parsed)) return parsed;
	return Array.isArray(parsed.blocks) ? parsed.blocks : [];
}

function collectionBlockTitles(blocksJson: string): string[] {
	return parseCollectionEntries(blocksJson).map((block) => block.title);
}

function sanitizeAuthorName(
	body: Record<string, unknown> | null,
): string | null {
	if (!body) return null;
	const raw = typeof body.authorName === "string" ? body.authorName.trim() : "";
	return raw.slice(0, 40) || null;
}

function sanitizeDescription(
	body: Record<string, unknown> | null,
): string | null {
	if (!body) return null;
	const raw =
		typeof body.description === "string" ? body.description.trim() : "";
	return raw.slice(0, 160) || null;
}

function homepageSummaryFromRow(row: {
	collection_id: string;
	title: string;
	block_count: number;
	installs: number;
	blocks_json: string;
	author_name?: string | null;
	description?: string | null;
}): HomepageSummary {
	return {
		collectionId: row.collection_id,
		title: row.title,
		blockCount: row.block_count,
		installs: row.installs,
		blockTitles: collectionBlockTitles(row.blocks_json),
		authorName: row.author_name ?? null,
		description: row.description ?? null,
	};
}

function sanitizeSharedBlock(raw: unknown): ImportableEntry | null {
	if (!raw || typeof raw !== "object") return null;
	const block = { ...(raw as Record<string, unknown>) };
	const id = typeof block.id === "string" ? block.id.trim() : "";
	const title = typeof block.title === "string" ? block.title.trim() : "";
	const preset = typeof block.preset === "string" ? block.preset : "";
	if (!id || !title) return null;
	if (!/^[a-zA-Z0-9_~.-]+$/.test(id)) return null;
	block.id = id;
	block.title = title;
	if (typeof block.style === "string") {
		if (!VALID_SHARED_STYLES.has(block.style)) delete block.style;
	} else {
		delete block.style;
	}
	if (preset === COLLECTION_PRESET) {
		if (!Array.isArray(block.children) || block.children.length === 0) {
			return null;
		}
		const children = block.children.filter((child) => {
			if (!child || typeof child !== "object") return false;
			const source = (child as { source?: { path?: unknown } }).source;
			return typeof source?.path === "string" && source.path.length > 0;
		});
		if (children.length === 0) return null;
		block.children = children;
		return block as unknown as ImportableCollectionBlock;
	}
	if (SPECIAL_SHARED_PRESETS.has(preset)) {
		return block as unknown as ImportableEntry;
	}
	if (!VALID_PRESETS.includes(preset as BlockPreset)) return null;
	const source = block.source as { path?: unknown } | undefined;
	if (!source || typeof source.path !== "string" || !source.path) return null;
	return block as unknown as ImportableBlock;
}

/** Community block row -> importable payload with an absolute data URL. */
function importableFromCommunity(row: CommunityBlockRow): ImportableBlock {
	const block = JSON.parse(row.block_json) as HomeBlock | CollectionBlock;
	// Collection children already carry absolute URLs — pass through as-is.
	if (block.preset === COLLECTION_PRESET) {
		return {
			...(block as CollectionBlock),
			category: row.category,
			author: row.author,
			itemCount: row.item_count,
			language: row.language,
		} as unknown as ImportableBlock;
	}
	const hb = block as HomeBlock;
	return {
		...hb,
		source: { ...hb.source, path: absoluteSourcePath(hb.source.path) },
		category: row.category,
		author: row.author,
		itemCount: row.item_count,
		language: row.language,
	};
}

/** Official default block -> importable payload (same wire shape). */
function importableFromOfficial(
	block: HomeBlock & { metadata?: { isAnime?: boolean } },
): ImportableBlock | null {
	if (!block.source?.path) return null;
	return {
		...block,
		source: { ...block.source, path: absoluteSourcePath(block.source.path) },
		category: block.metadata?.isAnime
			? "anime"
			: block.mediaType === "movie"
				? "movie"
				: "tv",
	};
}

/** Resolve mixed community/official block ids into importable payloads. */
async function resolveImportableBlocks(
	db: D1Database,
	blockIds: string[],
	language: string,
): Promise<ImportableBlock[]> {
	const community = await getCommunityBlocksByIds(db, blockIds);
	const official = officialHomeBlocksById(language);
	const blocks: ImportableBlock[] = [];
	for (const id of blockIds) {
		const row = community.get(id);
		if (row) {
			blocks.push(importableFromCommunity(row));
			continue;
		}
		const officialBlock = official.get(id);
		if (officialBlock) {
			const importable = importableFromOfficial(officialBlock);
			if (importable) blocks.push(importable);
		}
	}
	return blocks;
}

app.post("/collections", async (c) => {
	return c.json(
		{ error: "网页端首页创建已关闭，请在 iOS 客户端分享首页。" },
		410,
	);
});

app.post("/collections/share", async (c) => {
	const body = (await c.req.json().catch(() => null)) as Record<
		string,
		unknown
	> | null;
	const title = String(body?.title || "")
		.trim()
		.slice(0, MAX_COLLECTION_TITLE_LEN);
	const rawBlocks: unknown[] = Array.isArray(body?.blocks) ? body.blocks : [];
	const blocks = rawBlocks
		.map(sanitizeSharedBlock)
		.filter((block): block is ImportableEntry => block !== null);

	if (!title) return c.json({ error: "请填写首页标题" }, 400);
	if (blocks.length === 0) {
		return c.json({ error: "请至少选择一个区块" }, 400);
	}
	if (blocks.length > MAX_COLLECTION_BLOCKS) {
		return c.json({ error: `最多分享 ${MAX_COLLECTION_BLOCKS} 个区块` }, 400);
	}

	const collectionId = shortId();
	await insertBlockCollection(getDb(c), {
		collectionId,
		title,
		blocksJson: JSON.stringify({ version: 1, blocks }),
		blockCount: blocks.length,
		createdAt: new Date().toISOString(),
		status: "approved",
		authorName: sanitizeAuthorName(body),
		description: sanitizeDescription(body),
	});
	return c.json({
		ok: true,
		collectionId,
		blockCount: blocks.length,
		importUrl: `${IMPORT_LINK_BASE}?collectionId=${collectionId}`,
	});
});

/**
 * Unified import payload for the client. The universal link
 * `https://eplayerx.com/import/blocks?collectionId=..` (or `?blockId=..`)
 * opens the app, which fetches this endpoint with the same query params.
 */
app.get("/import-payload", async (c) => {
	const collectionId = (c.req.query("collectionId") || "").replace(
		/[^a-zA-Z0-9_-]/g,
		"",
	);
	const blockId = (c.req.query("blockId") || "").replace(/[^a-zA-Z0-9_-]/g, "");
	const language = c.req.query("language") || DEFAULT_LANGUAGE;

	try {
		const db = getDb(c);
		if (collectionId) {
			const row = await getBlockCollection(db, collectionId);
			if (!row || row.status !== "approved") {
				return c.json({ error: "首页不存在" }, 404);
			}
			return c.json({
				type: "block_import",
				id: row.collection_id,
				title: row.title,
				blocks: parseCollectionEntries(row.blocks_json),
			});
		}
		if (blockId) {
			const blocks = await resolveImportableBlocks(db, [blockId], language);
			if (blocks.length === 0) return c.json({ error: "区块不存在" }, 404);
			return c.json({
				type: "block_import",
				id: blockId,
				title: blocks[0].title,
				blocks,
			});
		}
		return c.json({ error: "缺少 collectionId 或 blockId" }, 400);
	} catch (error) {
		if (error instanceof ServiceUnavailable) {
			return c.json({ error: "服务暂不可用" }, 503);
		}
		throw error;
	}
});

app.post("/collections/:collectionId/install", async (c) => {
	const collectionId = c.req
		.param("collectionId")
		.replace(/[^a-zA-Z0-9_-]/g, "");
	try {
		await incrementCollectionInstalls(getDb(c), collectionId);
	} catch {
		// best-effort metric
	}
	return c.json({ ok: true });
});

app.post("/:blockId/install", async (c) => {
	const blockId = c.req.param("blockId").replace(/[^a-zA-Z0-9_-]/g, "");
	try {
		await incrementInstalls(getDb(c), blockId);
	} catch {
		// best-effort metric
	}
	return c.json({ ok: true });
});

/**
 * Mounted at `/import` on the root app. `GET /import/blocks` is the browser
 * fallback for the universal link: devices with the app installed open the
 * app instead, everyone else sees a preview + App Store link.
 */
export const importLandingApp = new Hono<{ Bindings: BlocksBindings }>();

importLandingApp.get("/blocks", async (c) => {
	const collectionId = (c.req.query("collectionId") || "").replace(
		/[^a-zA-Z0-9_-]/g,
		"",
	);
	const blockId = (c.req.query("blockId") || "").replace(/[^a-zA-Z0-9_-]/g, "");
	try {
		const db = getDb(c);
		let title = "";
		let blockTitles: string[] = [];
		if (collectionId) {
			const row = await getBlockCollection(db, collectionId);
			if (!row || row.status !== "approved") return c.notFound();
			title = row.title;
			blockTitles = collectionBlockTitles(row.blocks_json);
		} else if (blockId) {
			const blocks = await resolveImportableBlocks(
				db,
				[blockId],
				DEFAULT_LANGUAGE,
			);
			if (blocks.length === 0) return c.notFound();
			title = blocks[0].title;
			blockTitles = blocks.map((b) => b.title);
		} else {
			return c.notFound();
		}
		const query = collectionId
			? `collectionId=${collectionId}`
			: `blockId=${blockId}`;
		return c.html(
			<ImportLandingPage
				title={title}
				blockTitles={blockTitles}
				importUrl={`${IMPORT_LINK_BASE}?${query}`}
			/>,
		);
	} catch (error) {
		if (error instanceof ServiceUnavailable) {
			return c.text("服务暂不可用", 503);
		}
		throw error;
	}
});

export default app;

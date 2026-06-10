/** @jsxImportSource hono/jsx */
/// <reference types="@cloudflare/workers-types" />
/**
 * EplayerX Blocks — public portal + consumption API.
 *
 * `/blocks` is the community library (home). Submitters declare a free-form
 * data source + their TMDB token; the admin scrapes it on approval (see
 * `admin.tsx`). Approved blocks are served to the client unchanged.
 */

import { Hono } from "hono";
import { createDefaultHomeConfig } from "../home/config.js";
import { getDb, ServiceUnavailable, shortId } from "./runtime.js";
import { validateToken } from "./scraper.js";
import {
	incrementInstalls,
	insertSubmission,
	listCommunityBlocks,
	publicDataUrl,
} from "./storage.js";
import {
	type BlockCategory,
	type BlockPreset,
	type BlocksBindings,
	type CommunityBlockRow,
	DEFAULT_LANGUAGE,
	type DisplayBlock,
	type HomeBlock,
	type MediaType,
	TMDB_LANGUAGES,
} from "./types.js";
import { ExplorePage, SubmitPage } from "./views.js";

const app = new Hono<{ Bindings: BlocksBindings }>();

const IMAGE_BASE =
	process.env.TMDB_IMAGE_BASE_URL || "https://image.tmdb.org/t/p";
const VALID_PRESETS: BlockPreset[] = ["thumb-list", "poster-list", "hero-list"];
const VALID_CATEGORIES: BlockCategory[] = ["movie", "tv", "anime"];
const MEDIA_LIST_PRESETS = new Set(VALID_PRESETS);
const VALID_LANGUAGES = new Set(TMDB_LANGUAGES.map((l) => l.code));

const MAX_SOURCE_LEN = 100_000;

const PUBLIC_API_BASE =
	process.env.PUBLIC_API_BASE_URL || "https://api.eplayerx.com";
const R2_PUBLIC_BASE = `https://${process.env.R2_CUSTOM_DOMAIN || "assets.eplayerx.com"}`;
const CRAWLER_POPULAR_PREFIX = "/crawler/popular/";

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
	const path = source.path.startsWith("/") ? source.path : `/${source.path}`;
	return qs ? `${PUBLIC_API_BASE}${path}?${qs}` : `${PUBLIC_API_BASE}${path}`;
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
		});
	}
	return blocks;
}

function communityToDisplay(row: CommunityBlockRow): DisplayBlock {
	let preset: BlockPreset = "thumb-list";
	let showRank = false;
	let showOverview = false;
	try {
		const hb = JSON.parse(row.block_json) as HomeBlock;
		if (VALID_PRESETS.includes(hb.preset)) preset = hb.preset;
		showRank = !!hb.showRank;
		showOverview = !!hb.showOverview;
	} catch {
		// fall back to defaults on malformed JSON
	}
	return {
		id: row.block_id,
		title: row.title,
		category: row.category,
		preset,
		showRank,
		showOverview,
		previewSrc: `/blocks/data/${row.block_id}`,
		official: false,
		itemCount: row.item_count,
		installs: row.installs,
		author: row.author,
	};
}

// MARK: - Community library (home)

app.get("/", async (c) => {
	const raw = c.req.query("category");
	const category: BlockCategory | "all" = VALID_CATEGORIES.includes(
		raw as BlockCategory,
	)
		? (raw as BlockCategory)
		: "all";
	const language = c.req.query("language") || "zh-CN";

	// Render every category up-front; the tabs filter client-side (instant, no
	// reload, previews fetched once and kept in the DOM).
	let community: CommunityBlockRow[] = [];
	try {
		community = await listCommunityBlocks(getDb(c));
	} catch {
		community = [];
	}

	const blocks: DisplayBlock[] = [
		...officialBlocks(language),
		...community.map(communityToDisplay),
	];

	return c.html(
		<ExplorePage blocks={blocks} imageBase={IMAGE_BASE} category={category} />,
	);
});

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

app.get("/community", async (c) => {
	const raw = c.req.query("category");
	const category = VALID_CATEGORIES.includes(raw as BlockCategory)
		? (raw as BlockCategory)
		: undefined;
	try {
		const rows = await listCommunityBlocks(getDb(c), category);
		const blocks = rows.map((r) => JSON.parse(r.block_json) as HomeBlock);
		return c.json({ version: 1, blocks });
	} catch (error) {
		if (error instanceof ServiceUnavailable) {
			return c.json({ version: 1, blocks: [] });
		}
		throw error;
	}
});

app.get("/data/:blockId", async (c) => {
	const blockId = c.req.param("blockId").replace(/[^a-zA-Z0-9_-]/g, "");
	const response = await fetch(publicDataUrl(blockId));
	return new Response(response.body, {
		status: response.status,
		headers: {
			"Content-Type":
				response.headers.get("Content-Type") || "application/json",
		},
	});
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

export default app;

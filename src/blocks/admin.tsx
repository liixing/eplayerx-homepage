/** @jsxImportSource hono/jsx */
/// <reference types="@cloudflare/workers-types" />
/**
 * EplayerX Blocks — admin review console, mounted at `/admin` (password gated).
 *
 * Scraping happens offline: the admin (or a GitHub Action) runs a script from
 * scripts/blocks/ that uploads the snapshot to R2 and reports it to
 * POST /admin/api/report (registered in the block_snapshots table). On
 * approval the admin pastes that blockId here, optionally edits the
 * submission's display params; the server validates purely against D1.
 */

import { type Context, Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import {
	isCollectionBlockJson,
	makeCollectionBlock,
	parseCollectionInput,
	parseCollectionStyle,
	resolveCollectionChildren,
	resolveCollectionStyle,
} from "./collections.js";
import { getDb, shortId } from "./runtime.js";
import {
	communityBlockExists,
	deleteCommunityBlock,
	getBlockSnapshot,
	getCommunityBlock,
	getSubmission,
	insertCommunityBlock,
	listCommunityBlocks,
	listSubmissions,
	markApproved,
	markRejected,
	publicAssetUrl,
	publicKey,
	updateCommunityBlockItemCount,
	updateCommunityBlockJson,
	upsertBlockSnapshot,
} from "./storage.js";
import {
	type BlockCategory,
	type BlockPreset,
	type BlocksBindings,
	COLLECTION_PRESET,
	type CollectionBlock,
	type CollectionChildSpec,
	type CollectionMode,
	type CollectionStyle,
	DEFAULT_LANGUAGE,
	type HomeBlock,
	type MediaType,
	type SubmissionRow,
	type TmdbListRoute,
} from "./types.js";
import {
	type AdminCollectionRow,
	AdminLoginPage,
	AdminPage,
} from "./views.js";

const app = new Hono<{ Bindings: BlocksBindings }>();

const ADMIN_COOKIE = "blocks_admin";

const CATEGORIES: readonly BlockCategory[] = ["movie", "tv", "anime"];
const MEDIA_TYPES: readonly MediaType[] = ["movie", "tv"];
const PRESETS: readonly BlockPreset[] = [
	"thumb-list",
	"poster-list",
	"hero-list",
];

function adminPassword(): string | undefined {
	return process.env.BLOCKS_ADMIN_PASSWORD;
}

export function isAdmin(c: Context): boolean {
	const pw = adminPassword();
	return !!pw && getCookie(c, ADMIN_COOKIE) === pw;
}

function pickEnum<T extends string>(
	value: unknown,
	allowed: readonly T[],
	fallback: T,
): T {
	return allowed.includes(value as T) ? (value as T) : fallback;
}

function pickBool(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

/** Bearer auth for script/CI endpoints (cookie auth is browser-only). */
function isAdminBearer(c: Context): boolean {
	const pw = adminPassword();
	const header = c.req.header("Authorization") || "";
	return !!pw && header === `Bearer ${pw}`;
}

/** Published `collection-list` community blocks, for the admin panel. */
async function listPublishedCollections(
	db: D1Database,
): Promise<AdminCollectionRow[]> {
	const rows = await listCommunityBlocks(db);
	const collections: AdminCollectionRow[] = [];
	for (const row of rows) {
		if (!isCollectionBlockJson(row.block_json)) continue;
		const block = JSON.parse(row.block_json) as CollectionBlock;
		collections.push({
			blockId: row.block_id,
			title: row.title,
			mode: block.groupMode,
			children: block.children.map((ch) => ({
				id: ch.id,
				label: ch.label,
				image: ch.image,
			})),
			installs: row.installs,
		});
	}
	return collections;
}

app.get("/", async (c) => {
	if (!isAdmin(c)) return c.html(<AdminLoginPage />);
	let pending: SubmissionRow[] = [];
	let collections: AdminCollectionRow[] = [];
	try {
		const db = getDb(c);
		const [subs, cols] = await Promise.all([
			listSubmissions(db, "pending"),
			listPublishedCollections(db),
		]);
		pending = subs;
		collections = cols;
	} catch {
		pending = [];
	}
	return c.html(
		<AdminPage
			pending={pending}
			collections={collections}
		/>,
	);
});

app.post("/login", async (c) => {
	const body = await c.req.parseBody();
	const pw = adminPassword();
	if (pw && body.password === pw) {
		// Path "/" (not "/admin") so the explore page can detect the admin
		// session and render admin-only tools (e.g. collection builder).
		setCookie(c, ADMIN_COOKIE, pw, {
			httpOnly: true,
			sameSite: "Lax",
			path: "/",
			maxAge: 60 * 60 * 12,
		});
		return c.redirect("/admin");
	}
	return c.html(<AdminLoginPage error />);
});

interface ApproveBody {
	blockId?: string;
	title?: string;
	category?: string;
	mediaType?: string;
	preset?: string;
	showRank?: boolean;
	showOverview?: boolean;
	isAnime?: boolean;
}

/**
 * Hand the submitter's TMDB token to the publish script at runtime, so
 * tokens never live in the (public) repo — only submission ids do.
 */
app.get("/api/token/:submissionId", async (c) => {
	if (!isAdminBearer(c)) return c.json({ error: "unauthorized" }, 401);
	const sub = await getSubmission(getDb(c), c.req.param("submissionId"));
	if (!sub?.tmdb_token) {
		return c.json({ error: "submission or token not found" }, 404);
	}
	return c.json({ token: sub.tmdb_token });
});

interface ReportBody {
	blockId?: string;
	itemCount?: number;
	scriptPath?: string;
}

/** Publish report from the local/CI script: register the snapshot in D1. */
app.post("/api/report", async (c) => {
	if (!isAdminBearer(c)) return c.json({ error: "unauthorized" }, 401);
	const body = (await c.req.json().catch(() => ({}))) as ReportBody;
	const blockId = String(body.blockId ?? "").trim();
	const itemCount = Number(body.itemCount) || 0;
	if (!/^[a-zA-Z0-9_-]+$/.test(blockId) || itemCount <= 0) {
		return c.json({ error: "invalid blockId or itemCount" }, 400);
	}
	const scriptPath = String(body.scriptPath ?? "").slice(0, 300) || null;

	const db = getDb(c);
	await upsertBlockSnapshot(db, {
		blockId,
		itemCount,
		scriptPath,
		updatedAt: new Date().toISOString(),
	});
	// Scheduled refreshes: keep an already-approved block's count in sync.
	if (await communityBlockExists(db, blockId)) {
		await updateCommunityBlockItemCount(db, blockId, itemCount);
	}
	return c.json({ ok: true, blockId, itemCount });
});

interface RegisterHiddenBody {
	blockId?: string;
	title?: string;
	category?: string;
	mediaType?: string;
	preset?: string;
	showRank?: boolean;
	showOverview?: boolean;
	isAnime?: boolean;
	language?: string;
	author?: string;
	route?: TmdbListRoute;
}

function parseTmdbListRoute(raw: unknown): TmdbListRoute | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const o = raw as Record<string, unknown>;
	if (o.type !== "tmdb-list") return undefined;
	const title = String(o.title ?? "").trim();
	const params = o.params as Record<string, unknown> | undefined;
	if (!title || !params || typeof params !== "object") return undefined;
	const category = params.category;
	const type = params.type;
	if (
		category !== "trending" &&
		category !== "top-rated" &&
		category !== "discover"
	) {
		return undefined;
	}
	if (type !== "movie" && type !== "tv") return undefined;
	return {
		type: "tmdb-list",
		title,
		params: {
			category,
			type,
			...(typeof params.genre === "string" ? { genre: params.genre } : {}),
			...(typeof params.language === "string"
				? { language: params.language }
				: {}),
			...(typeof params.network === "string"
				? { network: params.network }
				: {}),
			...(typeof params.networkName === "string"
				? { networkName: params.networkName }
				: {}),
			...(typeof params.watchProvider === "string"
				? { watchProvider: params.watchProvider }
				: {}),
			...(typeof params.watchRegion === "string"
				? { watchRegion: params.watchRegion }
				: {}),
			...(typeof params.originCountry === "string"
				? { originCountry: params.originCountry }
				: {}),
			...(typeof params.company === "string"
				? { company: params.company }
				: {}),
			...(typeof params.companyName === "string"
				? { companyName: params.companyName }
				: {}),
			...(typeof params.releaseDateGte === "string"
				? { releaseDateGte: params.releaseDateGte }
				: {}),
			...(typeof params.releaseDateLte === "string"
				? { releaseDateLte: params.releaseDateLte }
				: {}),
		},
	};
}

/** Register a published snapshot as a hidden, collection-only chart (no
 * submission needed). Hidden charts never list in the public library; they
 * stay in D1 so weekday collections can be built and rebuilt anytime. */
app.post("/api/register-hidden", async (c) => {
	if (!isAdmin(c) && !isAdminBearer(c)) {
		return c.json({ error: "unauthorized" }, 401);
	}
	const body = (await c.req.json().catch(() => ({}))) as RegisterHiddenBody;
	const blockId = String(body.blockId ?? "").trim();
	const title = String(body.title ?? "").trim();
	if (!/^[a-zA-Z0-9_-]+$/.test(blockId)) {
		return c.json({ error: "请填写合法的 blockId（字母/数字/-/_）" }, 400);
	}
	if (!title) return c.json({ error: "请填写名称" }, 400);

	const db = getDb(c);
	if (await communityBlockExists(db, blockId)) {
		return c.json({ error: "blockId 已存在。" }, 400);
	}
	const snapshot = await getBlockSnapshot(db, blockId);
	if (!snapshot || snapshot.item_count === 0) {
		return c.json(
			{ error: "未找到该 blockId 的发布记录，请先运行发布脚本。" },
			400,
		);
	}

	const category = pickEnum(body.category, CATEGORIES, "tv" as BlockCategory);
	const mediaType = pickEnum(body.mediaType, MEDIA_TYPES, "tv" as MediaType);
	const preset = pickEnum(body.preset, PRESETS, "poster-list" as BlockPreset);
	const isAnime = body.isAnime === true;
	const route = parseTmdbListRoute(body.route);
	const block: HomeBlock = {
		id: blockId,
		title,
		mediaType,
		preset,
		showRank: body.showRank === true,
		showOverview: body.showOverview === true,
		source: { path: `/blocks/data/${blockId}`, itemEnvelope: "data" },
		...(route ? { route } : {}),
		...(isAnime ? { metadata: { isAnime: true } } : {}),
	};
	await insertCommunityBlock(db, {
		blockId,
		category,
		title,
		blockJson: JSON.stringify(block),
		dataKey: publicKey(blockId),
		itemCount: snapshot.item_count,
		author: String(body.author ?? "").slice(0, 40) || null,
		language: String(body.language || DEFAULT_LANGUAGE),
		createdAt: new Date().toISOString(),
		hidden: true,
	});
	return c.json({ ok: true, blockId, itemCount: snapshot.item_count });
});

/** Freeze + publish a collection as a `collection-list` community block. */
async function publishCollection(
	db: D1Database,
	input: {
		blockId: string;
		title: string;
		category: BlockCategory;
		mode: CollectionMode;
		style?: CollectionStyle;
		children: CollectionChildSpec[];
		language: string;
		author: string | null;
	},
): Promise<{ ok: true; itemCount: number } | { ok: false; error: string }> {
	if (await communityBlockExists(db, input.blockId)) {
		return { ok: false, error: "blockId 已存在，请换一个唯一的 blockId。" };
	}
	const resolved = await resolveCollectionChildren(
		db,
		input.children,
		input.language,
	);
	if (resolved.children.length < 2) {
		return { ok: false, error: "可用的子榜单不足 2 个（可能已被删除）。" };
	}
	const block = makeCollectionBlock(
		input.blockId,
		input.title,
		input.mode,
		resolved.children,
		resolveCollectionStyle(input.title, input.style),
	);
	await insertCommunityBlock(db, {
		blockId: input.blockId,
		category: input.category,
		title: input.title,
		blockJson: JSON.stringify(block),
		dataKey: resolved.dataKey,
		itemCount: resolved.itemCount,
		author: input.author,
		language: input.language,
		createdAt: new Date().toISOString(),
	});
	return { ok: true, itemCount: resolved.itemCount };
}

/** Admin-only: create + publish a collection directly (no review step). */
app.post("/collections/create", async (c) => {
	if (!isAdmin(c)) return c.json({ error: "unauthorized" }, 401);
	const body = (await c.req.json().catch(() => ({}))) as Record<
		string,
		unknown
	>;
	const parsed = parseCollectionInput(body);
	if ("error" in parsed) return c.json({ error: parsed.error }, 400);
	const { input } = parsed;
	const category = pickEnum(body.category, CATEGORIES, "tv" as BlockCategory);
	const language = String(body.language || DEFAULT_LANGUAGE);
	const blockId = `col-${shortId()}`;

	const db = getDb(c);
	const result = await publishCollection(db, {
		blockId,
		title: input.title,
		category,
		mode: input.mode,
		style: input.style,
		children: input.children,
		language,
		author: null,
	});
	if (!result.ok) return c.json({ error: result.error }, 400);
	return c.json({ ok: true, blockId, itemCount: result.itemCount });
});

const ASSET_TYPES: Record<string, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/webp": "webp",
	"image/svg+xml": "svg",
};
const MAX_ASSET_BYTES = 2 * 1024 * 1024;

/** Admin-only: upload a logo into the shared crawler/snapshot bucket
 * (`assets.eplayerx.com` serves it directly); returns the public URL. */
app.post("/assets/upload", async (c) => {
	if (!isAdmin(c)) return c.json({ error: "unauthorized" }, 401);
	const bucket = c.env.ASSETS;
	if (!bucket) return c.json({ error: "R2 bucket 未绑定（ASSETS）" }, 500);
	const contentType = (c.req.header("Content-Type") || "").split(";")[0];
	const ext = ASSET_TYPES[contentType];
	if (!ext) return c.json({ error: "仅支持 png / jpg / webp / svg" }, 400);
	const body = await c.req.arrayBuffer();
	if (body.byteLength === 0) return c.json({ error: "空文件" }, 400);
	if (body.byteLength > MAX_ASSET_BYTES) {
		return c.json({ error: "图片需小于 2MB" }, 400);
	}
	// Same prefix convention as `blocks/public/` snapshots.
	const key = `blocks/logos/${shortId()}.${ext}`;
	await bucket.put(key, body, { httpMetadata: { contentType } });
	return c.json({ ok: true, url: publicAssetUrl(key) });
});

/** Admin-only: set / clear one child's logo on a published collection. */
app.post("/collections/:blockId/child-image", async (c) => {
	if (!isAdmin(c)) return c.json({ error: "unauthorized" }, 401);
	const blockId = c.req.param("blockId").replace(/[^a-zA-Z0-9_-]/g, "");
	const body = (await c.req.json().catch(() => ({}))) as Record<
		string,
		unknown
	>;
	const childId = String(body.childId || "");
	const image = String(body.image || "").trim();
	if (image && !image.startsWith("https://")) {
		return c.json({ error: "图片地址必须是 https URL" }, 400);
	}
	const db = getDb(c);
	const row = await getCommunityBlock(db, blockId);
	if (!row || !isCollectionBlockJson(row.block_json)) {
		return c.json({ error: "合集不存在" }, 404);
	}
	const block = JSON.parse(row.block_json) as CollectionBlock;
	const child = block.children.find((ch) => ch.id === childId);
	if (!child) return c.json({ error: "子榜单不存在" }, 404);
	if (image) {
		child.image = image;
	} else {
		delete child.image;
	}
	await updateCommunityBlockJson(db, blockId, JSON.stringify(block));
	return c.json({ ok: true, image: child.image ?? "" });
});

/** Admin-only: unpublish a collection (plain chart blocks are untouchable). */
app.post("/collections/:blockId/delete", async (c) => {
	if (!isAdmin(c)) return c.json({ error: "unauthorized" }, 401);
	const blockId = c.req.param("blockId").replace(/[^a-zA-Z0-9_-]/g, "");
	const db = getDb(c);
	const row = await getCommunityBlock(db, blockId);
	if (!row || !isCollectionBlockJson(row.block_json)) {
		return c.json({ error: "合集不存在" }, 404);
	}
	await deleteCommunityBlock(db, blockId);
	return c.json({ ok: true });
});

app.post("/:id/approve", async (c) => {
	if (!isAdmin(c)) return c.json({ error: "unauthorized" }, 401);
	const id = c.req.param("id");
	const db = getDb(c);
	const sub = await getSubmission(db, id);
	if (!sub) return c.json({ error: "投稿不存在" }, 404);
	if (sub.status !== "pending") return c.json({ error: "该投稿已处理" }, 400);

	const body = (await c.req.json().catch(() => ({}))) as ApproveBody;

	// Collection submissions need no snapshot: freeze the child specs from
	// the submission and publish under a generated blockId.
	if (sub.preset === COLLECTION_PRESET) {
		let spec: {
			mode?: CollectionMode;
			style?: CollectionStyle;
			children?: CollectionChildSpec[];
		};
		try {
			spec = JSON.parse(sub.source_spec);
		} catch {
			return c.json({ error: "投稿数据损坏" }, 400);
		}
		const blockId = `col-${shortId()}`;
		const title = String(body.title ?? "").trim() || sub.title;
		const category = pickEnum(body.category, CATEGORIES, sub.category);
		const specStyle = parseCollectionStyle(spec.style);
		const result = await publishCollection(db, {
			blockId,
			title,
			category,
			mode: spec.mode === "weekday" ? "weekday" : "custom",
			style: resolveCollectionStyle(title, specStyle),
			children: spec.children ?? [],
			language: sub.language,
			author: sub.author,
		});
		if (!result.ok) return c.json({ error: result.error }, 400);
		await markApproved(
			db,
			id,
			blockId,
			result.itemCount,
			new Date().toISOString(),
		);
		return c.json({ ok: true, blockId, itemCount: result.itemCount });
	}

	const blockId = String(body.blockId ?? "").trim();
	if (!/^[a-zA-Z0-9_-]+$/.test(blockId)) {
		return c.json({ error: "请填写合法的 blockId（字母/数字/-/_）" }, 400);
	}

	if (await communityBlockExists(db, blockId)) {
		return c.json({ error: "blockId 已存在，请换一个唯一的 blockId。" }, 400);
	}
	const snapshot = await getBlockSnapshot(db, blockId);
	if (!snapshot) {
		return c.json(
			{ error: "未找到该 blockId 的发布记录，请先运行发布脚本。" },
			400,
		);
	}
	const itemCount = snapshot.item_count;
	if (itemCount === 0) {
		return c.json({ error: "快照为空，请检查发布脚本的输出。" }, 400);
	}

	// Admin-edited fields override the submission's original values.
	const title = String(body.title ?? "").trim() || sub.title;
	const category = pickEnum(body.category, CATEGORIES, sub.category);
	const mediaType = pickEnum(body.mediaType, MEDIA_TYPES, sub.media_type);
	// Collection submissions returned above, so this is a plain chart preset.
	const preset = pickEnum(body.preset, PRESETS, sub.preset as BlockPreset);
	const showRank = pickBool(body.showRank, !!sub.show_rank);
	const showOverview = pickBool(body.showOverview, !!sub.show_overview);
	const isAnime = pickBool(body.isAnime, !!sub.is_anime);

	const block: HomeBlock = {
		id: blockId,
		title,
		mediaType,
		preset,
		showRank,
		showOverview,
		source: { path: `/blocks/data/${blockId}`, itemEnvelope: "data" },
		...(isAnime ? { metadata: { isAnime: true } } : {}),
	};

	const now = new Date().toISOString();
	await insertCommunityBlock(db, {
		blockId,
		category,
		title,
		blockJson: JSON.stringify(block),
		dataKey: publicKey(blockId),
		itemCount,
		author: sub.author,
		language: sub.language,
		createdAt: now,
	});
	await markApproved(db, id, blockId, itemCount, now);
	return c.json({ ok: true, blockId, itemCount });
});

app.post("/:id/reject", async (c) => {
	if (!isAdmin(c)) return c.json({ error: "unauthorized" }, 401);
	const id = c.req.param("id");
	const body = await c.req.json().catch(() => ({}));
	const reason = String(body?.reason || "").slice(0, 200);
	await markRejected(getDb(c), id, reason, new Date().toISOString());
	return c.json({ ok: true });
});

export default app;

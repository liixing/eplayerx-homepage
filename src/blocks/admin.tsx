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
	resolveCollectionChildren,
} from "./collections.js";
import { getDb, shortId } from "./runtime.js";
import {
	approveBlockCollection,
	communityBlockExists,
	deleteBlockCollection,
	deleteCommunityBlock,
	getBlockSnapshot,
	getCommunityBlock,
	getSubmission,
	insertCommunityBlock,
	listCommunityBlocks,
	listPendingBlockCollections,
	listSubmissions,
	markApproved,
	markRejected,
	publicKey,
	updateCommunityBlockItemCount,
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
	DEFAULT_LANGUAGE,
	type HomeBlock,
	type MediaType,
	type SubmissionRow,
} from "./types.js";
import {
	type AdminCollectionRow,
	type AdminHomepageRow,
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

function isAdmin(c: Context): boolean {
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
			childLabels: block.children.map((ch) => ch.label),
			installs: row.installs,
		});
	}
	return collections;
}

app.get("/", async (c) => {
	if (!isAdmin(c)) return c.html(<AdminLoginPage />);
	let pending: SubmissionRow[] = [];
	let collections: AdminCollectionRow[] = [];
	let homepages: AdminHomepageRow[] = [];
	try {
		const db = getDb(c);
		const [subs, cols, pages] = await Promise.all([
			listSubmissions(db, "pending"),
			listPublishedCollections(db),
			listPendingBlockCollections(db),
		]);
		pending = subs;
		collections = cols;
		homepages = pages.map((row) => ({
			collectionId: row.collection_id,
			title: row.title,
			blockTitles: (JSON.parse(row.blocks_json) as { title: string }[]).map(
				(b) => b.title,
			),
			createdAt: row.created_at,
		}));
	} catch {
		pending = [];
	}
	return c.html(
		<AdminPage
			pending={pending}
			collections={collections}
			homepages={homepages}
		/>,
	);
});

app.post("/login", async (c) => {
	const body = await c.req.parseBody();
	const pw = adminPassword();
	if (pw && body.password === pw) {
		setCookie(c, ADMIN_COOKIE, pw, {
			httpOnly: true,
			sameSite: "Lax",
			path: "/admin",
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

/** Freeze + publish a collection as a `collection-list` community block. */
async function publishCollection(
	db: D1Database,
	input: {
		blockId: string;
		title: string;
		category: BlockCategory;
		mode: CollectionMode;
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
		children: input.children,
		language,
		author: null,
	});
	if (!result.ok) return c.json({ error: result.error }, 400);
	return c.json({ ok: true, blockId, itemCount: result.itemCount });
});

/** Approve a shared homepage: its import link goes live. */
app.post("/homepages/:collectionId/approve", async (c) => {
	if (!isAdmin(c)) return c.json({ error: "unauthorized" }, 401);
	const collectionId = c.req
		.param("collectionId")
		.replace(/[^a-zA-Z0-9_-]/g, "");
	await approveBlockCollection(getDb(c), collectionId);
	return c.json({ ok: true });
});

/** Reject (delete) a shared homepage submission. */
app.post("/homepages/:collectionId/delete", async (c) => {
	if (!isAdmin(c)) return c.json({ error: "unauthorized" }, 401);
	const collectionId = c.req
		.param("collectionId")
		.replace(/[^a-zA-Z0-9_-]/g, "");
	await deleteBlockCollection(getDb(c), collectionId);
	return c.json({ ok: true });
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
		let spec: { mode?: CollectionMode; children?: CollectionChildSpec[] };
		try {
			spec = JSON.parse(sub.source_spec);
		} catch {
			return c.json({ error: "投稿数据损坏" }, 400);
		}
		const blockId = `col-${shortId()}`;
		const title = String(body.title ?? "").trim() || sub.title;
		const category = pickEnum(body.category, CATEGORIES, sub.category);
		const result = await publishCollection(db, {
			blockId,
			title,
			category,
			mode: spec.mode === "weekday" ? "weekday" : "custom",
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

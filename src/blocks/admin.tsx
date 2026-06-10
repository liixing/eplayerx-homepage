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
import { getDb } from "./runtime.js";
import {
	communityBlockExists,
	getBlockSnapshot,
	getSubmission,
	insertCommunityBlock,
	listSubmissions,
	markApproved,
	markRejected,
	publicKey,
	updateCommunityBlockItemCount,
	upsertBlockSnapshot,
} from "./storage.js";
import type {
	BlockCategory,
	BlockPreset,
	BlocksBindings,
	HomeBlock,
	MediaType,
} from "./types.js";
import { AdminLoginPage, AdminPage } from "./views.js";

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

app.get("/", async (c) => {
	if (!isAdmin(c)) return c.html(<AdminLoginPage />);
	let pending: Awaited<ReturnType<typeof listSubmissions>> = [];
	try {
		pending = await listSubmissions(getDb(c), "pending");
	} catch {
		pending = [];
	}
	return c.html(<AdminPage pending={pending} />);
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

app.post("/:id/approve", async (c) => {
	if (!isAdmin(c)) return c.json({ error: "unauthorized" }, 401);
	const id = c.req.param("id");
	const db = getDb(c);
	const sub = await getSubmission(db, id);
	if (!sub) return c.json({ error: "投稿不存在" }, 404);
	if (sub.status !== "pending") return c.json({ error: "该投稿已处理" }, 400);

	const body = (await c.req.json().catch(() => ({}))) as ApproveBody;
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
	const preset = pickEnum(body.preset, PRESETS, sub.preset);
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

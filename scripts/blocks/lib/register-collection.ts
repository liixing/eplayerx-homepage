/**
 * Shared helpers for fusion / multi-block collection registration.
 *
 * Order matters:
 *   1. Publish every child snapshot (publish script → R2 + block_snapshots)
 *   2. registerHiddenChildren — only children with snapshots proceed
 *   3. createCollection — admin API (also writes preview blob on the worker)
 *   4. warmCollectionPreviewR2 — belt-and-suspenders local R2 preview write
 */

import {
	buildCollectionPreviewChildren,
	COLLECTION_PREVIEW_LIMIT,
} from "../../../src/blocks/collections.js";
import {
	isCollectionPreviewBlob,
	publicKey,
	putCollectionPreviewBlob,
	getSnapshot,
} from "../../../src/blocks/storage.js";
import {
	COLLECTION_PRESET,
	type CollectionBlock,
	type CollectionChildSpec,
	type CollectionMode,
	type CollectionStyle,
} from "../../../src/blocks/types.js";

const API_BASE = process.env.API_BASE_URL || "https://api.eplayerx.com";

export interface CollectionChildInput {
	blockId: string;
	label: string;
	image?: string;
	weekday?: number;
}

export type RegisterHiddenResult = "registered" | "exists" | "no_snapshot" | "error";

function adminPassword(): string {
	const raw = process.env.BLOCKS_ADMIN_PASSWORD;
	if (!raw) throw new Error("BLOCKS_ADMIN_PASSWORD missing from .env");
	return raw;
}

export async function adminFetch(
	path: string,
	init: RequestInit = {},
): Promise<Response> {
	return fetch(`${API_BASE}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${adminPassword()}`,
			...(init.headers ?? {}),
		},
	});
}

export async function loginCookie(): Promise<string> {
	const pass = adminPassword();
	const res = await fetch(`${API_BASE}/admin/login`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({ password: pass }),
		redirect: "manual",
	});
	const setCookie = res.headers.get("set-cookie") ?? "";
	const m = setCookie.match(/blocks_admin=([^;]+)/);
	if (!m) throw new Error("Admin login failed");
	return `blocks_admin=${m[1]}`;
}

/** Register one hidden child. Requires a prior publishBlock / block_snapshots row. */
export async function registerHiddenChild(opts: {
	blockId: string;
	title: string;
	category: "movie" | "tv" | "anime";
	mediaType: "movie" | "tv";
	language: string;
	preset?: "poster-list" | "thumb-list" | "hero-list";
	isAnime?: boolean;
}): Promise<RegisterHiddenResult> {
	const res = await adminFetch("/admin/api/register-hidden", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			blockId: opts.blockId,
			title: opts.title,
			category: opts.category,
			mediaType: opts.mediaType,
			preset: opts.preset ?? "poster-list",
			language: opts.language,
			...(opts.isAnime ? { isAnime: true } : {}),
		}),
	});
	const body = (await res.json()) as { ok?: boolean; error?: string };
	if (res.ok && body.ok) return "registered";
	if (body.error?.includes("已存在")) return "exists";
	if (body.error?.includes("未找到")) return "no_snapshot";
	return "error";
}

export interface RegisterHiddenSummary {
	ready: CollectionChildInput[];
	missing: string[];
	registered: number;
	existing: number;
}

/**
 * Register hidden children. Returns only blockIds whose snapshots exist.
 * Aborts the caller when `strict` and any child is missing a snapshot.
 */
export async function registerHiddenChildren(
	entries: Array<{ blockId: string; title: string; image?: string; weekday?: number }>,
	opts: {
		category: "movie" | "tv" | "anime";
		mediaType: "movie" | "tv";
		language: string;
		isAnime?: boolean;
		strict?: boolean;
	},
): Promise<RegisterHiddenSummary> {
	const ready: CollectionChildInput[] = [];
	const missing: string[] = [];
	let registered = 0;
	let existing = 0;

	for (const entry of entries) {
		const result = await registerHiddenChild({
			blockId: entry.blockId,
			title: entry.title,
			category: opts.category,
			mediaType: opts.mediaType,
			language: opts.language,
			isAnime: opts.isAnime,
		});
		switch (result) {
			case "registered":
				registered += 1;
				ready.push({
					blockId: entry.blockId,
					label: entry.title.slice(0, 14),
					...(entry.image ? { image: entry.image } : {}),
					...(entry.weekday ? { weekday: entry.weekday } : {}),
				});
				if (registered % 25 === 0) console.log(`registered ${registered}…`);
				break;
			case "exists":
				existing += 1;
				ready.push({
					blockId: entry.blockId,
					label: entry.title.slice(0, 14),
					...(entry.image ? { image: entry.image } : {}),
					...(entry.weekday ? { weekday: entry.weekday } : {}),
				});
				break;
			case "no_snapshot":
				missing.push(entry.blockId);
				console.warn(`✗ no snapshot: ${entry.blockId} — run publish script first`);
				break;
			default:
				throw new Error(`${entry.blockId}: register-hidden failed`);
		}
	}

	if (opts.strict !== false && missing.length > 0) {
		console.error(
			`\n${missing.length} child block(s) missing snapshots. Publish them before creating the collection.`,
		);
		process.exit(1);
	}
	if (ready.length < 2) {
		console.error("Fewer than 2 ready children — cannot create collection.");
		process.exit(1);
	}

	return { ready, missing, registered, existing };
}

export async function createCollection(opts: {
	title: string;
	category: "movie" | "tv" | "anime";
	mode: CollectionMode;
	style?: CollectionStyle;
	language: string;
	children: CollectionChildInput[];
}): Promise<{ blockId: string; itemCount: number }> {
	const cookie = await loginCookie();
	const children: CollectionChildSpec[] = opts.children.map((c) => ({
		blockId: c.blockId,
		label: c.label,
		...(c.weekday ? { weekday: c.weekday } : {}),
		...(c.image ? { image: c.image } : {}),
	}));
	const res = await fetch(`${API_BASE}/admin/collections/create`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Cookie: cookie,
		},
		body: JSON.stringify({
			title: opts.title,
			category: opts.category,
			mode: opts.mode,
			...(opts.style ? { style: opts.style } : {}),
			language: opts.language,
			children,
		}),
	});
	const body = (await res.json()) as {
		ok?: boolean;
		blockId?: string;
		itemCount?: number;
		error?: string;
	};
	if (!res.ok || !body.ok || !body.blockId) {
		throw new Error(`Collection create failed: ${body.error ?? res.status}`);
	}
	return { blockId: body.blockId, itemCount: body.itemCount ?? 0 };
}

async function fetchCollectionBlock(
	colId: string,
): Promise<CollectionBlock | null> {
	const res = await fetch(
		new URL(`/blocks/import-payload?blockId=${colId}`, API_BASE),
	);
	if (!res.ok) return null;
	const payload = (await res.json()) as { blocks?: CollectionBlock[] };
	const block = payload.blocks?.[0];
	if (!block || block.preset !== COLLECTION_PRESET || !block.children?.length) {
		return null;
	}
	return block;
}

/** Write merged preview blob directly to R2 (safe for prod — no worker lazy-build). */
export async function warmCollectionPreviewR2(
	colId: string,
	opts: { force?: boolean } = {},
): Promise<boolean> {
	if (!opts.force) {
		try {
			const raw = await getSnapshot(publicKey(colId));
			if (isCollectionPreviewBlob(raw)) {
				console.log(`⏭ preview already warm: ${colId}`);
				return false;
			}
		} catch {
			// not found — proceed
		}
	}
	const block = await fetchCollectionBlock(colId);
	if (!block) throw new Error(`${colId}: cannot load collection block`);
	const previewChildren = await buildCollectionPreviewChildren(
		block.children,
		COLLECTION_PREVIEW_LIMIT,
	);
	const count = Object.keys(previewChildren).length;
	if (count < 2) {
		throw new Error(`${colId}: only ${count} child previews built`);
	}
	await putCollectionPreviewBlob(colId, previewChildren, block.title);
	console.log(`✓ preview warmed: ${colId} (${count} children)`);
	return true;
}

/**
 * Register hidden blocks + create collection for arabic-fusion-collections.
 * Run after: bun run scripts/blocks/manual/arabic-fusion-collections.ts
 *
 * Run: bun run scripts/blocks/manual/register-ar-fusion-collections.ts
 */

import {
	fetchFusionTraktCollectionEntries,
	fusionBlockSuffix,
} from "../lib/fusion.js";

const SUBMISSION_ID = "ee34bbaf8ace";
const LANGUAGE = "ar-SA";
const SOURCE_URL =
	"https://raw.githubusercontent.com/djdirty60/Fusion/refs/heads/main/collection/collections.json";
const BLOCK_ID_PREFIX = "community-ar-fusion-collections";
const COLLECTION_TITLE = "الشبكات العالمية";
const API_BASE = "https://api.eplayerx.com";

function adminPassword(): string {
	const raw = process.env.BLOCKS_ADMIN_PASSWORD;
	if (!raw) throw new Error("BLOCKS_ADMIN_PASSWORD missing from .env");
	return raw;
}

async function adminFetch(
	path: string,
	init: RequestInit = {},
): Promise<Response> {
	const pass = adminPassword();
	const res = await fetch(`${API_BASE}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${pass}`,
			...(init.headers ?? {}),
		},
	});
	return res;
}

async function loginCookie(): Promise<string> {
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

const entries = await fetchFusionTraktCollectionEntries(SOURCE_URL);
let registered = 0;
let skipped = 0;

for (const entry of entries) {
	const blockId = `${BLOCK_ID_PREFIX}-${fusionBlockSuffix(entry.name)}`;
	const res = await adminFetch("/admin/api/register-hidden", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			blockId,
			title: entry.name,
			category: "movie",
			mediaType: "movie",
			preset: "poster-list",
			language: LANGUAGE,
		}),
	});
	const body = (await res.json()) as { ok?: boolean; error?: string };
	if (res.ok && body.ok) {
		registered += 1;
		if (registered % 25 === 0) console.log(`registered ${registered}…`);
		continue;
	}
	if (body.error?.includes("已存在")) {
		skipped += 1;
		continue;
	}
	if (body.error?.includes("未找到")) {
		console.warn(`skip (no snapshot): ${blockId}`);
		skipped += 1;
		continue;
	}
	throw new Error(`${blockId}: ${body.error ?? res.status}`);
}

console.log(`✓ registered ${registered}, skipped ${skipped}`);

const cookie = await loginCookie();
const children = entries.map((entry) => ({
	blockId: `${BLOCK_ID_PREFIX}-${fusionBlockSuffix(entry.name)}`,
	label: entry.name.slice(0, 14),
	...(entry.imageURL ? { image: entry.imageURL } : {}),
}));

const createRes = await fetch(`${API_BASE}/admin/collections/create`, {
	method: "POST",
	headers: {
		"Content-Type": "application/json",
		Cookie: cookie,
	},
	body: JSON.stringify({
		title: COLLECTION_TITLE,
		category: "movie",
		mode: "custom",
		style: "image-portrait",
		language: LANGUAGE,
		children,
	}),
});
const createBody = (await createRes.json()) as {
	ok?: boolean;
	blockId?: string;
	itemCount?: number;
	error?: string;
};
if (!createRes.ok || !createBody.ok || !createBody.blockId) {
	throw new Error(`Collection create failed: ${createBody.error ?? createRes.status}`);
}

console.log(`✓ collection ${createBody.blockId} (${createBody.itemCount} items)`);

const reviewedAt = new Date().toISOString();
const proc = Bun.spawnSync(
	[
		"bunx",
		"wrangler",
		"d1",
		"execute",
		"blocks",
		"--remote",
		"--command",
		`UPDATE submissions SET status='approved', block_id='${createBody.blockId}', item_count=${createBody.itemCount}, reviewed_at='${reviewedAt}' WHERE id='${SUBMISSION_ID}'`,
	],
	{ cwd: process.cwd(), stdout: "inherit", stderr: "inherit" },
);
if (proc.exitCode !== 0) process.exit(1);
console.log(`✓ submission ${SUBMISSION_ID} approved`);

/// <reference types="@cloudflare/workers-types" />
/**
 * Storage layer for EplayerX Blocks.
 *
 * - Approved snapshots live in R2 (public), reusing the crawler bucket + domain.
 * - Submission queue + approved blocks live in D1 (Workers binding `DB`).
 */

import {
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import type {
	BlockCategory,
	BlockCollectionRow,
	CommunityBlockRow,
	MediaType,
	SnapshotBlob,
	SnapshotItem,
	SubmissionRow,
	SubmissionStatus,
} from "./types.js";

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_CUSTOM_DOMAIN = process.env.R2_CUSTOM_DOMAIN || "assets.eplayerx.com";

const r2Endpoint =
	process.env.R2_ENDPOINT ||
	(process.env.R2_ACCOUNT_ID
		? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
		: undefined);

let _client: S3Client | null = null;
function r2(): S3Client {
	if (!_client) {
		_client = new S3Client({
			region: "auto",
			endpoint: r2Endpoint,
			credentials: {
				accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
				secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
			},
			forcePathStyle: true,
		});
	}
	return _client;
}

export function publicKey(blockId: string): string {
	return `blocks/public/${blockId}.json`;
}

export function publicDataUrl(blockId: string): string {
	return `https://${R2_CUSTOM_DOMAIN}/${publicKey(blockId)}`;
}

/** Public URL of any object in the bucket (custom domain serves it as-is). */
export function publicAssetUrl(key: string): string {
	return `https://${R2_CUSTOM_DOMAIN}/${key}`;
}

function makeBlob(items: SnapshotItem[], title?: string): SnapshotBlob {
	return {
		type: "community_block",
		count: items.length,
		lastUpdated: new Date().toISOString(),
		...(title ? { title } : {}),
		data: items,
	};
}

export async function putSnapshot(
	key: string,
	items: SnapshotItem[],
	title?: string,
): Promise<void> {
	if (!R2_BUCKET_NAME) {
		throw new Error("R2_BUCKET_NAME is not configured");
	}
	await r2().send(
		new PutObjectCommand({
			Bucket: R2_BUCKET_NAME,
			Key: key,
			Body: JSON.stringify(makeBlob(items, title)),
			ContentType: "application/json",
		}),
	);
}

async function streamToString(body: unknown): Promise<string> {
	if (
		typeof (body as { transformToString?: unknown })?.transformToString ===
		"function"
	) {
		return (
			body as { transformToString: () => Promise<string> }
		).transformToString();
	}
	return new Response(body as ReadableStream).text();
}

/** Read a public snapshot straight from the bucket (no CDN). */
export async function getSnapshot(key: string): Promise<SnapshotBlob> {
	if (!R2_BUCKET_NAME) {
		throw new Error("R2_BUCKET_NAME is not configured");
	}
	const result = await r2().send(
		new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }),
	);
	const text = await streamToString(result.Body);
	return JSON.parse(text) as SnapshotBlob;
}

// MARK: - D1 queries

export interface BlockSnapshotRow {
	block_id: string;
	item_count: number;
	script_path: string | null;
	updated_at: string;
}

function presetFromBlockJson(blockJson: string): string {
	try {
		const preset = (JSON.parse(blockJson) as { preset?: unknown }).preset;
		return typeof preset === "string" ? preset : "";
	} catch {
		return "";
	}
}

/** Record (or refresh) a snapshot publish reported by the local/CI script. */
export async function upsertBlockSnapshot(
	db: D1Database,
	input: {
		blockId: string;
		itemCount: number;
		scriptPath: string | null;
		updatedAt: string;
	},
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO block_snapshots (block_id, item_count, script_path, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(block_id) DO UPDATE SET
         item_count = excluded.item_count,
         script_path = excluded.script_path,
         updated_at = excluded.updated_at`,
		)
		.bind(input.blockId, input.itemCount, input.scriptPath, input.updatedAt)
		.run();
}

export async function getBlockSnapshot(
	db: D1Database,
	blockId: string,
): Promise<BlockSnapshotRow | null> {
	return db
		.prepare(`SELECT * FROM block_snapshots WHERE block_id = ?`)
		.bind(blockId)
		.first<BlockSnapshotRow>();
}

export async function communityBlockExists(
	db: D1Database,
	blockId: string,
): Promise<boolean> {
	const row = await db
		.prepare(`SELECT 1 AS one FROM community_blocks WHERE block_id = ?`)
		.bind(blockId)
		.first<{ one: number }>();
	return !!row;
}

/** Rewrite a published block's frozen JSON (admin edits, e.g. child logos). */
export async function updateCommunityBlockJson(
	db: D1Database,
	blockId: string,
	blockJson: string,
): Promise<void> {
	await db
		.prepare(
			`UPDATE community_blocks SET block_json = ?, preset = ? WHERE block_id = ?`,
		)
		.bind(blockJson, presetFromBlockJson(blockJson), blockId)
		.run();
}

/** Keep an approved block's item count in sync after a snapshot refresh. */
export async function updateCommunityBlockItemCount(
	db: D1Database,
	blockId: string,
	itemCount: number,
): Promise<void> {
	await db
		.prepare(`UPDATE community_blocks SET item_count = ? WHERE block_id = ?`)
		.bind(itemCount, blockId)
		.run();
}

export interface InsertSubmissionInput {
	id: string;
	category: BlockCategory;
	mediaType: MediaType;
	isAnime: boolean;
	title: string;
	preset: string;
	showRank: boolean;
	showOverview: boolean;
	language: string;
	source: string;
	/** Null for collection submissions — nothing to scrape. */
	tmdbToken: string | null;
	author: string | null;
	createdAt: string;
}

export async function insertSubmission(
	db: D1Database,
	input: InsertSubmissionInput,
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO submissions
        (id, status, category, media_type, is_anime, title, preset, show_rank,
         show_overview, language, source_spec, tmdb_token, author, created_at)
       VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			input.id,
			input.category,
			input.mediaType,
			input.isAnime ? 1 : 0,
			input.title,
			input.preset,
			input.showRank ? 1 : 0,
			input.showOverview ? 1 : 0,
			input.language,
			input.source,
			input.tmdbToken,
			input.author,
			input.createdAt,
		)
		.run();
}

export async function listSubmissions(
	db: D1Database,
	status: SubmissionStatus,
): Promise<SubmissionRow[]> {
	const result = await db
		.prepare(
			`SELECT * FROM submissions WHERE status = ? ORDER BY created_at DESC LIMIT 200`,
		)
		.bind(status)
		.all<SubmissionRow>();
	return result.results ?? [];
}

export async function getSubmission(
	db: D1Database,
	id: string,
): Promise<SubmissionRow | null> {
	return db
		.prepare(`SELECT * FROM submissions WHERE id = ?`)
		.bind(id)
		.first<SubmissionRow>();
}

export async function markApproved(
	db: D1Database,
	id: string,
	blockId: string,
	itemCount: number,
	reviewedAt: string,
): Promise<void> {
	await db
		.prepare(
			`UPDATE submissions
       SET status = 'approved', block_id = ?, item_count = ?, reviewed_at = ?
       WHERE id = ?`,
		)
		.bind(blockId, itemCount, reviewedAt, id)
		.run();
}

export async function markRejected(
	db: D1Database,
	id: string,
	reason: string,
	reviewedAt: string,
): Promise<void> {
	await db
		.prepare(
			`UPDATE submissions SET status = 'rejected', reject_reason = ?, reviewed_at = ? WHERE id = ?`,
		)
		.bind(reason, reviewedAt, id)
		.run();
}

export interface InsertCommunityBlockInput {
	blockId: string;
	category: BlockCategory;
	title: string;
	blockJson: string;
	dataKey: string;
	itemCount: number;
	author: string | null;
	language: string;
	createdAt: string;
	/** Collection-only chart: registered for collection building, not listed. */
	hidden?: boolean;
}

export async function insertCommunityBlock(
	db: D1Database,
	input: InsertCommunityBlockInput,
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO community_blocks
        (block_id, category, title, block_json, preset, data_key, item_count, installs, author, language, created_at, hidden)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
		)
		.bind(
			input.blockId,
			input.category,
			input.title,
			input.blockJson,
			presetFromBlockJson(input.blockJson),
			input.dataKey,
			input.itemCount,
			input.author,
			input.language,
			input.createdAt,
			input.hidden ? 1 : 0,
		)
		.run();
}

export interface CommunityBlockFilter {
	category?: BlockCategory;
	language?: string;
	/** Title substring search. */
	q?: string;
	/** "collection" keeps only collection-list blocks. */
	kind?: "collection";
}

/** Build the WHERE clause + bind values for a community block filter.
 *  Hidden (collection-only) charts never reach public listings. */
function communityWhere(filter: CommunityBlockFilter): {
	clause: string;
	binds: (string | number)[];
} {
	const conditions: string[] = ["hidden = 0"];
	const binds: (string | number)[] = [];
	if (filter.category) {
		conditions.push("category = ?");
		binds.push(filter.category);
	}
	if (filter.kind === "collection") {
		conditions.push("preset = ?");
		binds.push("collection-list");
	}
	if (filter.language) {
		conditions.push("language = ?");
		binds.push(filter.language);
	}
	if (filter.q) {
		conditions.push("title LIKE ? ESCAPE '\\'");
		binds.push(`%${filter.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
	}
	return {
		clause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
		binds,
	};
}

export async function listCommunityBlocks(
	db: D1Database,
	filter: CommunityBlockFilter = {},
	limit = 200,
	offset = 0,
): Promise<CommunityBlockRow[]> {
	const { clause, binds } = communityWhere(filter);
	const result = await db
		.prepare(
			`SELECT * FROM community_blocks ${clause} ORDER BY installs DESC, created_at DESC LIMIT ? OFFSET ?`,
		)
		.bind(...binds, limit, offset)
		.all<CommunityBlockRow>();
	return result.results ?? [];
}

export async function countCommunityBlocks(
	db: D1Database,
	filter: CommunityBlockFilter = {},
): Promise<number> {
	const { clause, binds } = communityWhere(filter);
	const row = await db
		.prepare(`SELECT COUNT(*) AS n FROM community_blocks ${clause}`)
		.bind(...binds)
		.first<{ n: number }>();
	return row?.n ?? 0;
}

/** Distinct output languages present in the library (for the filter menu). */
export async function listCommunityLanguages(
	db: D1Database,
): Promise<string[]> {
	const result = await db
		.prepare(
			`SELECT DISTINCT language FROM community_blocks WHERE language != '' AND hidden = 0 ORDER BY language`,
		)
		.all<{ language: string }>();
	return (result.results ?? []).map((r) => r.language);
}

export async function getCommunityBlock(
	db: D1Database,
	blockId: string,
): Promise<CommunityBlockRow | null> {
	return db
		.prepare(`SELECT * FROM community_blocks WHERE block_id = ?`)
		.bind(blockId)
		.first<CommunityBlockRow>();
}

export async function deleteCommunityBlock(
	db: D1Database,
	blockId: string,
): Promise<void> {
	await db
		.prepare(`DELETE FROM community_blocks WHERE block_id = ?`)
		.bind(blockId)
		.run();
}

export async function incrementInstalls(
	db: D1Database,
	blockId: string,
): Promise<void> {
	await db
		.prepare(
			`UPDATE community_blocks SET installs = installs + 1 WHERE block_id = ?`,
		)
		.bind(blockId)
		.run();
}

/** Fetch several community blocks by id, preserving the requested order. */
export async function getCommunityBlocksByIds(
	db: D1Database,
	blockIds: string[],
): Promise<Map<string, CommunityBlockRow>> {
	if (blockIds.length === 0) return new Map();
	const out = new Map<string, CommunityBlockRow>();
	const BATCH = 100;
	for (let i = 0; i < blockIds.length; i += BATCH) {
		const batch = blockIds.slice(i, i + BATCH);
		const placeholders = batch.map(() => "?").join(", ");
		const result = await db
			.prepare(
				`SELECT * FROM community_blocks WHERE block_id IN (${placeholders})`,
			)
			.bind(...batch)
			.all<CommunityBlockRow>();
		for (const row of result.results ?? []) {
			out.set(row.block_id, row);
		}
	}
	return out;
}

// MARK: - Block collections

export async function insertBlockCollection(
	db: D1Database,
	input: {
		collectionId: string;
		title: string;
		blocksJson: string;
		blockCount: number;
		createdAt: string;
		status: "pending" | "approved";
		authorName?: string | null;
		description?: string | null;
	},
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO block_collections
        (collection_id, title, blocks_json, block_count, installs, created_at, status, author_name, preview_image_url, description)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
		)
		.bind(
			input.collectionId,
			input.title,
			input.blocksJson,
			input.blockCount,
			input.createdAt,
			input.status,
			input.authorName ?? null,
			null,
			input.description ?? null,
		)
		.run();
}

/** Published homepages for the explore page, most installed first. */
export async function listApprovedBlockCollections(
	db: D1Database,
	limit = 100,
): Promise<BlockCollectionRow[]> {
	const result = await db
		.prepare(
			`SELECT * FROM block_collections WHERE status = 'approved' ORDER BY installs DESC, created_at DESC LIMIT ?`,
		)
		.bind(limit)
		.all<BlockCollectionRow>();
	return result.results ?? [];
}

export async function getBlockCollection(
	db: D1Database,
	collectionId: string,
): Promise<BlockCollectionRow | null> {
	return db
		.prepare(`SELECT * FROM block_collections WHERE collection_id = ?`)
		.bind(collectionId)
		.first<BlockCollectionRow>();
}

export async function incrementCollectionInstalls(
	db: D1Database,
	collectionId: string,
): Promise<void> {
	await db
		.prepare(
			`UPDATE block_collections SET installs = installs + 1 WHERE collection_id = ?`,
		)
		.bind(collectionId)
		.run();
}

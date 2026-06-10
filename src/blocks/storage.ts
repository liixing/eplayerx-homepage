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

function makeBlob(items: SnapshotItem[]): SnapshotBlob {
	return {
		type: "community_block",
		count: items.length,
		lastUpdated: new Date().toISOString(),
		data: items,
	};
}

export async function putSnapshot(
	key: string,
	items: SnapshotItem[],
): Promise<void> {
	if (!R2_BUCKET_NAME) {
		throw new Error("R2_BUCKET_NAME is not configured");
	}
	await r2().send(
		new PutObjectCommand({
			Bucket: R2_BUCKET_NAME,
			Key: key,
			Body: JSON.stringify(makeBlob(items)),
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
export async function getSnapshot(key: string): Promise<SnapshotItem[]> {
	if (!R2_BUCKET_NAME) {
		throw new Error("R2_BUCKET_NAME is not configured");
	}
	const result = await r2().send(
		new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }),
	);
	const text = await streamToString(result.Body);
	const blob = JSON.parse(text) as SnapshotBlob;
	return blob.data ?? [];
}

// MARK: - D1 queries

export interface BlockSnapshotRow {
	block_id: string;
	item_count: number;
	script_path: string | null;
	updated_at: string;
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
	tmdbToken: string;
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
	createdAt: string;
}

export async function insertCommunityBlock(
	db: D1Database,
	input: InsertCommunityBlockInput,
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO community_blocks
        (block_id, category, title, block_json, data_key, item_count, installs, author, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
		)
		.bind(
			input.blockId,
			input.category,
			input.title,
			input.blockJson,
			input.dataKey,
			input.itemCount,
			input.author,
			input.createdAt,
		)
		.run();
}

export async function listCommunityBlocks(
	db: D1Database,
	category?: BlockCategory,
): Promise<CommunityBlockRow[]> {
	const stmt = category
		? db
				.prepare(
					`SELECT * FROM community_blocks WHERE category = ? ORDER BY installs DESC, created_at DESC LIMIT 200`,
				)
				.bind(category)
		: db.prepare(
				`SELECT * FROM community_blocks ORDER BY installs DESC, created_at DESC LIMIT 200`,
			);
	const result = await stmt.all<CommunityBlockRow>();
	return result.results ?? [];
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

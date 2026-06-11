/**
 * Sync every published community block's display title from D1 (via the
 * worker listing) into its R2 snapshot blob. Blobs whose title already
 * matches are left untouched; collection rows have no snapshot and are
 * skipped.
 *
 * Run: bun run scripts/blocks/manual/sync-titles.ts
 */

import {
	getSnapshot,
	publicKey,
	putSnapshot,
} from "../../../src/blocks/storage.js";

interface ListedBlock {
	id: string;
	title: string;
	preset?: string;
}

const base = process.env.API_BASE_URL || "https://api.eplayerx.com";
const pageSize = 50;

const blocks: ListedBlock[] = [];
for (let offset = 0; ; offset += pageSize) {
	const res = await fetch(
		new URL(`/blocks/community?limit=${pageSize}&offset=${offset}`, base),
	);
	if (!res.ok) throw new Error(`listing failed (HTTP ${res.status})`);
	const page = (await res.json()) as { blocks: ListedBlock[]; total: number };
	blocks.push(...page.blocks);
	if (blocks.length >= page.total || page.blocks.length === 0) break;
}
console.log(`📋 ${blocks.length} published blocks`);

let updated = 0;
let unchanged = 0;
let failed = 0;
for (const block of blocks) {
	if (block.preset === "collection-list") continue;
	try {
		const key = publicKey(block.id);
		const blob = await getSnapshot(key);
		if (blob.title === block.title) {
			unchanged += 1;
			continue;
		}
		await putSnapshot(key, blob.data ?? [], block.title);
		updated += 1;
		console.log(`💾 ${block.id}: "${blob.title ?? ""}" -> "${block.title}"`);
	} catch (error) {
		failed += 1;
		console.error(`✗ ${block.id}: ${(error as Error).message}`);
	}
}
console.log(`✅ done: ${updated} updated, ${unchanged} unchanged, ${failed} failed`);

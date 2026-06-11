/**
 * Rewrite the display title of a published snapshot without re-scraping.
 * Downloads the R2 blob once, swaps the top-level title, re-uploads.
 *
 * Run: bun run scripts/blocks/manual/set-title.ts <blockId> [newTitle]
 * Omit [newTitle] to sync from the worker (the D1 row): rename the block in
 * D1/admin first, then run this to push the change into the R2 snapshot.
 */

import {
	getSnapshot,
	publicKey,
	putSnapshot,
} from "../../../src/blocks/storage.js";

const USAGE =
	"Usage: bun run scripts/blocks/manual/set-title.ts <blockId> [newTitle]";

const [blockId, ...titleParts] = process.argv.slice(2);
if (!blockId) {
	console.error(USAGE);
	process.exit(1);
}

let title = titleParts.join(" ").trim();
if (!title) {
	const base = process.env.API_BASE_URL || "https://api.eplayerx.com";
	const res = await fetch(
		new URL(`/blocks/import-payload?blockId=${blockId}`, base),
	);
	if (!res.ok) {
		throw new Error(
			`block ${blockId} not found on the worker (HTTP ${res.status}); pass the title explicitly`,
		);
	}
	title = ((await res.json()) as { title?: string }).title ?? "";
}
if (!title) {
	throw new Error("Resolved an empty title; pass it explicitly.");
}

const key = publicKey(blockId);
const blob = await getSnapshot(key);
await putSnapshot(key, blob.data ?? [], title);
console.log(
	`💾 ${blockId}: title "${blob.title ?? ""}" -> "${title}" (${blob.data?.length ?? 0} items kept)`,
);

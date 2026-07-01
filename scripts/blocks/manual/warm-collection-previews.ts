/**
 * Pre-build merged collection preview blobs in R2 (one object per collection).
 *
 * **When to run**
 * - One-time backfill for collections published before preview-at-publish shipped.
 * - After `--force` rebuild when many child snapshots were refreshed.
 *
 * **When NOT needed**
 * - New collections created via `register-*-collections.ts` or admin
 *   `/admin/collections/create` — those paths warm the preview automatically.
 *
 * Writes directly to R2 via local credentials — does NOT hit the public
 * `/blocks/data/:id` lazy-build route.
 *
 * Run:
 *   bun run scripts/blocks/manual/warm-collection-previews.ts           # skip warmed
 *   bun run scripts/blocks/manual/warm-collection-previews.ts --dry-run
 *   bun run scripts/blocks/manual/warm-collection-previews.ts --force   # rebuild all
 *   bun run scripts/blocks/manual/warm-collection-previews.ts col-abc…  # specific ids
 */

import {
	COLLECTION_PRESET,
	type CollectionBlock,
} from "../../../src/blocks/types.js";
import { warmCollectionPreviewR2 } from "../lib/register-collection.js";

const base = process.env.API_BASE_URL || "https://api.eplayerx.com";
const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const force = argv.includes("--force");
const colIds = argv.filter((a) => !a.startsWith("--"));

async function listCollectionIds(): Promise<string[]> {
	const out: string[] = [];
	const pageSize = 50;
	for (let offset = 0; ; offset += pageSize) {
		const url = new URL("/blocks/community", base);
		url.searchParams.set("kind", "collection");
		url.searchParams.set("limit", String(pageSize));
		url.searchParams.set("offset", String(offset));
		const res = await fetch(url);
		if (!res.ok) throw new Error(`listing failed (HTTP ${res.status})`);
		const page = (await res.json()) as {
			blocks: CollectionBlock[];
			total: number;
		};
		for (const block of page.blocks) {
			if (block.preset === COLLECTION_PRESET && block.children?.length) {
				out.push(block.id);
			}
		}
		if (offset + pageSize >= page.total || page.blocks.length === 0) break;
	}
	return out;
}

let warmed = 0;
let skipped = 0;
let failed = 0;

const targets = colIds.length > 0 ? colIds : await listCollectionIds();
console.log(
	`📋 ${targets.length} collection(s)${dryRun ? " (dry run)" : ""}${force ? " (force)" : ""}`,
);

for (const colId of targets) {
	if (dryRun) {
		console.log(`🔍 would warm ${colId}`);
		warmed += 1;
		continue;
	}
	try {
		const didWarm = await warmCollectionPreviewR2(colId, { force });
		if (didWarm) warmed += 1;
		else skipped += 1;
	} catch (error) {
		failed += 1;
		console.error(`✗ ${colId}: ${(error as Error).message}`);
	}
}

console.log(`✅ done: ${warmed} warmed, ${skipped} skipped, ${failed} failed`);

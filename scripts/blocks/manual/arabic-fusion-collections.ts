/**
 * Fusion movie franchise collections — Trakt lists from collections.json.
 * Submission: الشبكات العالمية (ee34bbaf8ace, ar-SA).
 *
 * Publishes hidden child snapshots for a custom image-portrait collection.
 * After this script, run register + create collection (see REVIEWING-SUBMISSIONS.md).
 *
 * Run: bun run scripts/blocks/manual/arabic-fusion-collections.ts
 * Test: LIMIT=3 bun run scripts/blocks/manual/arabic-fusion-collections.ts
 */

import { publishFusionTraktCollectionBlocks } from "../lib/publish-fusion-widget.js";

export const SUBMISSION_ID = "ee34bbaf8ace";
export const LANGUAGE = "ar-SA";
export const SOURCE_URL =
	"https://raw.githubusercontent.com/djdirty60/Fusion/refs/heads/main/collection/collections.json";
export const BLOCK_ID_PREFIX = "community-ar-fusion-collections";

const limit = process.env.LIMIT
	? Number.parseInt(process.env.LIMIT, 10)
	: undefined;

export const children = await publishFusionTraktCollectionBlocks({
	submissionId: SUBMISSION_ID,
	language: LANGUAGE,
	blockIdPrefix: BLOCK_ID_PREFIX,
	sourceUrl: SOURCE_URL,
	limit,
});

console.log("\nCollection children spec:");
for (const child of children) {
	console.log(
		`${child.blockId} | ${child.label}${child.image ? ` | ${child.image}` : ""}`,
	);
}

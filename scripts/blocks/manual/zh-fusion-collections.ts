/**
 * Fusion movie franchise collections — zh-CN counterpart of col-5b39a5ceeac6.
 * TMDB token: submission 7cd4b35f311e (@Zemkk).
 *
 * Run: bun run scripts/blocks/manual/zh-fusion-collections.ts
 * Test: LIMIT=3 bun run scripts/blocks/manual/zh-fusion-collections.ts
 */

import { publishFusionTraktCollectionBlocks } from "../lib/publish-fusion-widget.js";

export const SUBMISSION_ID = "7cd4b35f311e";
export const LANGUAGE = "zh-CN";
export const SOURCE_URL =
	"https://raw.githubusercontent.com/djdirty60/Fusion/refs/heads/main/collection/collections.json";
export const BLOCK_ID_PREFIX = "community-zh-fusion-collections";

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

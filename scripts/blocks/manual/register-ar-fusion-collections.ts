/**
 * Register hidden blocks + create collection for arabic-fusion-collections.
 *
 * Run AFTER child snapshots exist:
 *   bun run scripts/blocks/manual/arabic-fusion-collections.ts
 * Then:
 *   bun run scripts/blocks/manual/register-ar-fusion-collections.ts
 */

import {
	fetchFusionTraktCollectionEntries,
	fusionBlockSuffix,
} from "../lib/fusion.js";
import {
	createCollection,
	registerHiddenChildren,
	warmCollectionPreviewR2,
} from "../lib/register-collection.js";

const SUBMISSION_ID = "ee34bbaf8ace";
const LANGUAGE = "ar-SA";
const SOURCE_URL =
	"https://raw.githubusercontent.com/djdirty60/Fusion/refs/heads/main/collection/collections.json";
const BLOCK_ID_PREFIX = "community-ar-fusion-collections";
const COLLECTION_TITLE = "الشبكات العالمية";

const entries = await fetchFusionTraktCollectionEntries(SOURCE_URL);
const childEntries = entries.map((entry) => ({
	blockId: `${BLOCK_ID_PREFIX}-${fusionBlockSuffix(entry.name)}`,
	title: entry.name,
	...(entry.imageURL ? { image: entry.imageURL } : {}),
}));

const { ready, registered, existing } = await registerHiddenChildren(
	childEntries,
	{
		category: "movie",
		mediaType: "movie",
		language: LANGUAGE,
		strict: true,
	},
);
console.log(`✓ hidden blocks: ${registered} new, ${existing} existing, ${ready.length} ready`);

const { blockId, itemCount } = await createCollection({
	title: COLLECTION_TITLE,
	category: "movie",
	mode: "custom",
	style: "image-portrait",
	language: LANGUAGE,
	children: ready,
});
console.log(`✓ collection ${blockId} (${itemCount} items)`);

await warmCollectionPreviewR2(blockId);

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
		`UPDATE submissions SET status='approved', block_id='${blockId}', item_count=${itemCount}, reviewed_at='${reviewedAt}' WHERE id='${SUBMISSION_ID}'`,
	],
	{ cwd: process.cwd(), stdout: "inherit", stderr: "inherit" },
);
if (proc.exitCode !== 0) process.exit(1);
console.log(`✓ submission ${SUBMISSION_ID} approved`);

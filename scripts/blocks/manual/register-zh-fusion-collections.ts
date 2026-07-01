/**
 * Register hidden blocks + create zh-CN fusion collections block.
 *
 * Run AFTER child snapshots exist:
 *   bun run scripts/blocks/manual/zh-fusion-collections.ts
 * Then:
 *   bun run scripts/blocks/manual/register-zh-fusion-collections.ts
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

const LANGUAGE = "zh-CN";
const SOURCE_URL =
	"https://raw.githubusercontent.com/djdirty60/Fusion/refs/heads/main/collection/collections.json";
const BLOCK_ID_PREFIX = "community-zh-fusion-collections";
const COLLECTION_TITLE = "全球电影系列合集";

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

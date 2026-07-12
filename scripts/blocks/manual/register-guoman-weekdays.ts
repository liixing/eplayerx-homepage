/**
 * Register hidden weekday blocks + create 国漫周更表 collection.
 *
 * Run AFTER child snapshots exist:
 *   bun run scripts/blocks/weekly/guoman-weekdays.ts
 * Then:
 *   bun run scripts/blocks/manual/register-guoman-weekdays.ts
 */

import { GUOMAN_DAYS } from "../lib/guoman-weekdays.js";
import {
	createCollection,
	registerHiddenChildren,
	warmCollectionPreviewR2,
} from "../lib/register-collection.js";

const COLLECTION_TITLE = "国漫周更表";

const childEntries = GUOMAN_DAYS.map((d) => ({
	blockId: d.blockId,
	title: `国漫${d.label}更新`,
	weekday: d.weekday,
}));

const { ready, registered, existing } = await registerHiddenChildren(
	childEntries,
	{
		category: "anime",
		mediaType: "tv",
		language: "zh-CN",
		isAnime: true,
		strict: true,
	},
);
console.log(
	`✓ hidden blocks: ${registered} new, ${existing} existing, ${ready.length} ready`,
);

const { blockId, itemCount } = await createCollection({
	title: COLLECTION_TITLE,
	category: "anime",
	mode: "weekday",
	language: "zh-CN",
	children: ready.map((c, i) => ({
		...c,
		label: GUOMAN_DAYS[i].label,
		weekday: GUOMAN_DAYS[i].weekday,
	})),
});
console.log(`✓ collection ${blockId} (${itemCount} items)`);

await warmCollectionPreviewR2(blockId);

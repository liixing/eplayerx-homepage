/**
 * Patch studio / decade collection block_json: add per-child tmdb-list routes
 * without rebuilding the collection.
 *
 * Run: bun run scripts/blocks/manual/patch-studio-decade-collection-routes.ts [col-id...]
 */

import type { CollectionBlock, CollectionChild } from "../../../src/blocks/types.js";
import { spawnSync } from "node:child_process";
import { routeForDecadeBlock } from "../lib/decade-routes.js";
import { routeForStudioBlock } from "../lib/studio-routes.js";

const DEFAULT_COLS = [
	"col-93d0a08d94f1", // zh global studios
	"col-920cf6bb6ae0", // ar global studios
	"col-9e37cdc1f13d", // zh decades
	"col-d8ca1fd02a45", // ar decades
];
const colIds = process.argv.slice(2);
const targets = colIds.length > 0 ? colIds : DEFAULT_COLS;

function routeForChild(child: CollectionChild) {
	return (
		routeForStudioBlock(child.id, child.label) ??
		routeForDecadeBlock(child.id, child.label)
	);
}

function patchBlockJson(raw: string): { json: string; patched: number } {
	const block = JSON.parse(raw) as CollectionBlock;
	let patched = 0;
	const children: CollectionChild[] = block.children.map((child) => {
		const route = routeForChild(child);
		if (!route) return child;
		patched += 1;
		return { ...child, route };
	});
	return {
		json: JSON.stringify({ ...block, children }),
		patched,
	};
}

for (const colId of targets) {
	const res = await fetch(
		`https://api.eplayerx.com/blocks/import-payload?blockId=${colId}`,
	);
	if (!res.ok) {
		console.error(`✗ ${colId}: fetch failed (${res.status})`);
		continue;
	}
	const payload = (await res.json()) as {
		blocks?: CollectionBlock[];
	};
	const blockJson = payload.blocks?.[0];
	if (!blockJson || blockJson.preset !== "collection-list") {
		console.error(`✗ ${colId}: not a collection`);
		continue;
	}
	const { json, patched } = patchBlockJson(JSON.stringify(blockJson));
	const escaped = json.replace(/'/g, "''");
	const proc = spawnSync(
		"bunx",
		[
			"wrangler",
			"d1",
			"execute",
			"blocks",
			"--remote",
			"--command",
			`UPDATE community_blocks SET block_json='${escaped}' WHERE block_id='${colId}'`,
		],
		{
			cwd: "/Users/snow/Desktop/code/eplayerx-homepage",
			encoding: "utf-8",
		},
	);
	if (proc.status !== 0) {
		console.error(`✗ ${colId}: D1 update failed`, proc.stderr);
		continue;
	}
	console.log(`✓ ${colId}: patched ${patched} children with tmdb-list routes`);
}

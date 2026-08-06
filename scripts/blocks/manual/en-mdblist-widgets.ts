/**
 * Publish + optionally register en-US MDBList fusion widget collections.
 *
 * Pending submissions (2026-08-04) from 0-nj / Bot-Bid-Raiser / MOUSA.A —
 * fusion widget JSON hosted on github.com/0-nj/EplayerX.
 *
 * Usage:
 *   TARGET=directors bun run scripts/blocks/manual/en-mdblist-widgets.ts
 *   TARGET=all bun run scripts/blocks/manual/en-mdblist-widgets.ts
 *   TARGET=directors CHILD_LIMIT=1 LIMIT=5 bun run …   # smoke
 *   TARGET=directors REGISTER=1 bun run …             # publish + collection
 *   TARGET=directors REGISTER_ONLY=1 bun run …        # skip publish
 */

import type { CollectionStyle } from "../../../src/blocks/types.js";
import {
	fetchFusionAddonWidgetItems,
	fusionAspectToStyle,
	fusionBlockSuffix,
} from "../lib/fusion.js";
import { publishFusionAddonWidgetBlocks } from "../lib/publish-fusion-addon-widget.js";
import {
	createCollection,
	registerHiddenChildren,
	warmCollectionPreviewR2,
} from "../lib/register-collection.js";

interface WidgetTarget {
	key: string;
	submissionId: string;
	title: string;
	sourceUrl: string;
	blockIdPrefix: string;
	language: string;
	category: "movie" | "tv" | "anime";
	/** Override style; otherwise derived from first child's imageAspect. */
	style?: CollectionStyle;
}

const TARGETS: WidgetTarget[] = [
	{
		key: "directors",
		submissionId: "ba61089cb2b4",
		title: "Directors",
		sourceUrl:
			"https://raw.githubusercontent.com/0-nj/EplayerX/refs/heads/main/Directors",
		blockIdPrefix: "community-en-mdblist-directors",
		language: "en-US",
		category: "movie",
		style: "image-portrait",
	},
	{
		key: "actors",
		submissionId: "c42bb3fc0920",
		title: "Actors",
		sourceUrl:
			"https://raw.githubusercontent.com/0-nj/EplayerX/refs/heads/main/Actors",
		blockIdPrefix: "community-en-mdblist-actors",
		language: "en-US",
		category: "movie",
		style: "image-portrait",
	},
	{
		key: "collections",
		submissionId: "db34550dbfba",
		title: "Collections",
		sourceUrl:
			"https://raw.githubusercontent.com/0-nj/EplayerX/refs/heads/main/Collections",
		blockIdPrefix: "community-en-mdblist-collections",
		language: "en-US",
		category: "movie",
		style: "image-landscape",
	},
	{
		key: "streaming",
		submissionId: "e6fad43a9f18",
		title: "Streaming Services",
		sourceUrl:
			"https://raw.githubusercontent.com/0-nj/EplayerX/refs/heads/main/Streaming%20Services",
		blockIdPrefix: "community-en-mdblist-streaming",
		language: "en-US",
		category: "movie",
		// 纯图片横图（16:9 cover）
		style: "image-landscape",
	},
	{
		key: "awards",
		submissionId: "71f40c04d468",
		title: "Awards",
		sourceUrl:
			"https://raw.githubusercontent.com/0-nj/EplayerX/refs/heads/main/Awards",
		blockIdPrefix: "community-en-mdblist-awards",
		language: "en-US",
		category: "movie",
		style: "image-landscape",
	},
	{
		key: "studios",
		submissionId: "14257e33c426",
		title: "Studios",
		sourceUrl:
			"https://raw.githubusercontent.com/0-nj/EplayerX/refs/heads/main/Studios",
		blockIdPrefix: "community-en-mdblist-studios",
		language: "en-US",
		category: "movie",
		style: "image-landscape",
	},
	{
		key: "genres",
		submissionId: "c9fb91269733",
		title: "Genres",
		sourceUrl:
			"https://raw.githubusercontent.com/0-nj/EplayerX/refs/heads/main/Genres",
		blockIdPrefix: "community-en-mdblist-genres",
		language: "en-US",
		category: "movie",
		// Flat collection export: layout Poster → image-portrait
		style: "image-portrait",
	},
];

function resolveTargets(): WidgetTarget[] {
	const raw = (process.env.TARGET ?? "all").toLowerCase().trim();
	if (raw === "all") return TARGETS;
	const keys = raw.split(",").map((s) => s.trim()).filter(Boolean);
	const found = TARGETS.filter((t) => keys.includes(t.key));
	if (!found.length) {
		console.error(
			`Unknown TARGET=${raw}. Valid: all, ${TARGETS.map((t) => t.key).join(", ")}`,
		);
		process.exit(1);
	}
	return found;
}

async function approveSubmission(
	submissionId: string,
	blockId: string,
	itemCount: number,
): Promise<void> {
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
			`UPDATE submissions SET status='approved', block_id='${blockId}', item_count=${itemCount}, reviewed_at='${reviewedAt}' WHERE id='${submissionId}'`,
		],
		{ cwd: process.cwd(), stdout: "inherit", stderr: "inherit" },
	);
	if (proc.exitCode !== 0) {
		throw new Error(`Failed to approve submission ${submissionId}`);
	}
	console.log(`✓ submission ${submissionId} approved → ${blockId}`);
}

async function registerTarget(
	target: WidgetTarget,
	children: Array<{
		blockId: string;
		label: string;
		image?: string;
		imageAspect?: string;
		mediaType: "movie" | "tv";
	}>,
): Promise<void> {
	const style =
		target.style ??
		fusionAspectToStyle(children[0]?.imageAspect) ??
		"image-landscape";

	// Prefer movie mediaType for register-hidden unless all children are tv-only
	const allTv = children.every((c) => c.mediaType === "tv");
	const mediaType = allTv ? "tv" : "movie";

	const childEntries = children.map((c) => ({
		blockId: c.blockId,
		title: c.label,
		...(c.image ? { image: c.image } : {}),
	}));

	const { ready, registered, existing } = await registerHiddenChildren(
		childEntries,
		{
			category: target.category,
			mediaType,
			language: target.language,
			strict: true,
		},
	);
	console.log(
		`✓ hidden blocks: ${registered} new, ${existing} existing, ${ready.length} ready`,
	);

	const { blockId, itemCount } = await createCollection({
		title: target.title,
		category: target.category,
		mode: "custom",
		style,
		language: target.language,
		children: ready,
	});
	console.log(`✓ collection ${blockId} (${itemCount} items) style=${style}`);

	await warmCollectionPreviewR2(blockId);
	await approveSubmission(target.submissionId, blockId, itemCount);
}

async function processTarget(target: WidgetTarget): Promise<void> {
	console.log(`\n======== ${target.key}: ${target.title} (${target.submissionId}) ========`);

	const limit = process.env.LIMIT
		? Number.parseInt(process.env.LIMIT, 10)
		: undefined;
	const childLimit = process.env.CHILD_LIMIT
		? Number.parseInt(process.env.CHILD_LIMIT, 10)
		: undefined;
	const registerOnly = process.env.REGISTER_ONLY === "1";
	const doRegister =
		process.env.REGISTER === "1" || process.env.REGISTER_ONLY === "1";

	let children: Array<{
		blockId: string;
		label: string;
		image?: string;
		imageAspect?: string;
		mediaType: "movie" | "tv";
	}>;

	if (registerOnly) {
		const items = await fetchFusionAddonWidgetItems(target.sourceUrl);
		const slice = childLimit ? items.slice(0, childLimit) : items;
		children = slice.map((item) => ({
			blockId: `${target.blockIdPrefix}-${fusionBlockSuffix(item.title)}`,
			label: item.title,
			mediaType: item.sources.some((s) => s.type === "series")
				? ("tv" as const)
				: ("movie" as const),
			...(item.imageURL ? { image: item.imageURL } : {}),
			...(item.imageAspect ? { imageAspect: item.imageAspect } : {}),
		}));
		console.log(`REGISTER_ONLY: ${children.length} children from export`);
	} else {
		children = await publishFusionAddonWidgetBlocks({
			submissionId: target.submissionId,
			language: target.language,
			blockIdPrefix: target.blockIdPrefix,
			sourceUrl: target.sourceUrl,
			limit,
			childLimit,
		});
		console.log("\nCollection children spec:");
		for (const child of children) {
			console.log(
				`${child.blockId} | ${child.label}${child.image ? ` | ${child.image}` : ""}`,
			);
		}
	}

	if (doRegister) {
		await registerTarget(target, children);
	} else {
		console.log(
			`(skip register — re-run with REGISTER=1 after verifying snapshots)`,
		);
	}
}

const targets = resolveTargets();
for (const target of targets) {
	await processTarget(target);
}
console.log("\n✓ all targets done");

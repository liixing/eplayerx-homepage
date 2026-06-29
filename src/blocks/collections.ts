/// <reference types="@cloudflare/workers-types" />
/**
 * Collection blocks: a named group of charts (e.g. Mon-Sun anime schedules)
 * frozen into one `collection-list` block. Shared by the public submit
 * route, the admin create/approve paths and the import payload.
 */

import { createDefaultHomeConfig } from "../home/config.js";
import { getCommunityBlocksByIds } from "./storage.js";
import {
	type BlockCategory,
	type BlockPreset,
	COLLECTION_PRESET,
	type CollectionBlock,
	type CollectionChild,
	type CollectionChildSpec,
	type CollectionMode,
	type CollectionStyle,
	type HomeBlock,
} from "./types.js";

export const PUBLIC_API_BASE =
	process.env.PUBLIC_API_BASE_URL || "https://api.eplayerx.com";
export const IMAGE_BASE =
	process.env.TMDB_IMAGE_BASE_URL || "https://image.tmdb.org/t/p";

const MEDIA_LIST_PRESETS = new Set<BlockPreset>([
	"thumb-list",
	"poster-list",
	"hero-list",
]);

export const MAX_COLLECTION_CHILDREN = 300;
const MAX_LABEL_LEN = 14;
const MAX_TITLE_LEN = 40;

const VALID_COLLECTION_STYLES = new Set<CollectionStyle>([
	"rank",
	"banner",
	"image",
	"image-landscape",
	"image-portrait",
]);

/** Default collection card style for well-known fusion bundles. */
const TITLE_DEFAULT_STYLES: Record<string, CollectionStyle> = {
	Directors: "image-landscape",
	Decades: "image-landscape",
	Awards: "image-landscape",
};

export function parseCollectionStyle(value: unknown): CollectionStyle | undefined {
	const raw = String(value);
	return VALID_COLLECTION_STYLES.has(raw as CollectionStyle)
		? (raw as CollectionStyle)
		: undefined;
}

export function defaultCollectionStyle(title: string): CollectionStyle | undefined {
	return TITLE_DEFAULT_STYLES[title.trim()];
}

export function resolveCollectionStyle(
	title: string,
	style?: CollectionStyle,
): CollectionStyle | undefined {
	return style ?? defaultCollectionStyle(title);
}

export function absoluteSourcePath(path: string): string {
	if (path.startsWith("http://") || path.startsWith("https://")) return path;
	return `${PUBLIC_API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Resolve official default blocks once per request, keyed by id. */
export function officialHomeBlocksById(
	language: string,
): Map<string, HomeBlock> {
	const cfg = createDefaultHomeConfig({
		apiBaseUrl: "",
		imageBaseUrl: IMAGE_BASE,
		language,
		timezone: "UTC",
	});
	const entries = cfg.blocks
		.filter(
			(b) => b.mediaType && MEDIA_LIST_PRESETS.has(b.preset as BlockPreset),
		)
		.map((b) => [b.id, b as HomeBlock] as const);
	return new Map(entries);
}

export function officialBlockCategory(block: HomeBlock): BlockCategory {
	if (block.metadata?.isAnime) return "anime";
	return block.mediaType === "movie" ? "movie" : "tv";
}

export interface CollectionInput {
	title: string;
	mode: CollectionMode;
	style?: CollectionStyle;
	children: CollectionChildSpec[];
}

/** Parse + clamp a raw request body into a collection input, or an error. */
export function parseCollectionInput(
	body: unknown,
): { input: CollectionInput } | { error: string } {
	const raw = body as Record<string, unknown> | null;
	const title = String(raw?.title || "")
		.trim()
		.slice(0, MAX_TITLE_LEN);
	if (!title) return { error: "请填写合集标题" };

	const mode: CollectionMode = raw?.mode === "weekday" ? "weekday" : "custom";
	const style = parseCollectionStyle(raw?.style);
	const rawChildren = Array.isArray(raw?.children) ? raw.children : [];
	if (rawChildren.length < 2) return { error: "合集至少需要 2 个榜单" };
	if (rawChildren.length > MAX_COLLECTION_CHILDREN) {
		return { error: `最多选择 ${MAX_COLLECTION_CHILDREN} 个榜单` };
	}

	const children: CollectionChildSpec[] = [];
	const seen = new Set<string>();
	for (const entry of rawChildren as Record<string, unknown>[]) {
		const blockId = String(entry?.blockId || "");
		const label = String(entry?.label || "")
			.trim()
			.slice(0, MAX_LABEL_LEN);
		if (!/^[a-zA-Z0-9_-]+$/.test(blockId)) return { error: "榜单 ID 不合法" };
		if (seen.has(blockId)) continue;
		if (!label) return { error: "请为每个榜单填写标签" };
		seen.add(blockId);
		const weekday = Number(entry?.weekday);
		const image = String(entry?.image || "").trim();
		children.push({
			blockId,
			label,
			...(mode === "weekday" && weekday >= 1 && weekday <= 7
				? { weekday }
				: {}),
			...(image.startsWith("https://") ? { image } : {}),
		});
	}
	const resolvedStyle = resolveCollectionStyle(title, style);
	return {
		input: { title, mode, ...(resolvedStyle ? { style: resolvedStyle } : {}), children },
	};
}

export interface ResolvedCollection {
	children: CollectionChild[];
	category: BlockCategory;
	/** Sum of the community children's snapshot sizes (official ones count 0). */
	itemCount: number;
	/** R2 data key of the first community child, for bookkeeping. */
	dataKey: string;
}

function freezeCollectionChild(
	spec: CollectionChildSpec,
	block: HomeBlock,
): CollectionChild | null {
	const sourcePath = block.source?.path;
	const source = sourcePath
		? {
				...block.source,
				path: absoluteSourcePath(sourcePath),
			}
		: undefined;
	if (!source && !block.route) return null;
	return {
		id: spec.blockId,
		label: spec.label,
		...(spec.weekday ? { weekday: spec.weekday } : {}),
		...(spec.image ? { image: spec.image } : {}),
		title: block.title,
		mediaType: block.mediaType,
		preset: block.preset,
		showRank: block.showRank,
		showOverview: block.showOverview,
		...(source ? { source } : {}),
		...(block.route ? { route: block.route } : {}),
		...(block.metadata ? { metadata: block.metadata } : {}),
	};
}

/**
 * Freeze child specs into self-contained children: community charts resolve
 * from D1 (absolute `/blocks/data/...` URL), official charts from the
 * default home config. Unknown ids are dropped.
 */
export async function resolveCollectionChildren(
	db: D1Database,
	specs: CollectionChildSpec[],
	language: string,
): Promise<ResolvedCollection> {
	const community = await getCommunityBlocksByIds(
		db,
		specs.map((s) => s.blockId),
	);
	const official = officialHomeBlocksById(language);

	const children: CollectionChild[] = [];
	const categories: BlockCategory[] = [];
	let itemCount = 0;
	let dataKey = "";

	for (const spec of specs) {
		const row = community.get(spec.blockId);
		if (row) {
			let block: HomeBlock;
			try {
				block = JSON.parse(row.block_json) as HomeBlock;
			} catch {
				continue;
			}
			// Nested collections are not supported.
			const child = freezeCollectionChild(spec, block);
			if (!child) continue;
			children.push(child);
			categories.push(row.category);
			itemCount += row.item_count;
			if (!dataKey) dataKey = row.data_key;
			continue;
		}
		const officialBlock = official.get(spec.blockId);
		if (officialBlock) {
			const child = freezeCollectionChild(spec, officialBlock as HomeBlock);
			if (!child) continue;
			children.push(child);
			categories.push(officialBlockCategory(officialBlock));
		}
	}

	// Majority category wins; ties resolve to the first child's category.
	const counts = new Map<BlockCategory, number>();
	for (const cat of categories) counts.set(cat, (counts.get(cat) ?? 0) + 1);
	const category =
		[...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "tv";

	return { children, category, itemCount, dataKey };
}

export function makeCollectionBlock(
	blockId: string,
	title: string,
	mode: CollectionMode,
	children: CollectionChild[],
	style?: CollectionStyle,
): CollectionBlock {
	return {
		id: blockId,
		title,
		preset: COLLECTION_PRESET,
		groupMode: mode,
		children,
		...(style ? { style } : {}),
	};
}

export function isCollectionBlockJson(blockJson: string): boolean {
	try {
		const parsed = JSON.parse(blockJson) as { preset?: string };
		return parsed.preset === COLLECTION_PRESET;
	} catch {
		return false;
	}
}

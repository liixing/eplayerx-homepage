/**
 * Publish hidden child snapshots from fusion widget exports that use
 * AIOMetadata addonCatalog sources (MDBList / Trakt list / custom).
 */

import {
	type PublishItem,
	publishBlock,
} from "../../../src/blocks/publish.js";
import type { MediaType } from "../../../src/blocks/types.js";
import { fetchAioMetadataCatalogItems } from "./aiometadata.js";
import {
	type FusionAddonWidgetItem,
	fetchFusionAddonWidgetItems,
	fusionBlockSuffix,
} from "./fusion.js";

const DEFAULT_LIMIT = 100;

async function fetchChildItems(
	item: FusionAddonWidgetItem,
	limit: number,
): Promise<PublishItem[]> {
	const perSource = Math.max(
		20,
		Math.ceil(limit / Math.max(1, item.sources.length)),
	);
	const out: PublishItem[] = [];
	const seen = new Set<string>();
	const errors: string[] = [];
	for (const source of item.sources) {
		try {
			const rows = await fetchAioMetadataCatalogItems({
				catalogId: source.catalogId,
				type: source.type,
				limit: perSource,
			});
			for (const row of rows) {
				const key = row.tmdbId
					? `${row.mediaType ?? ""}:${row.tmdbId}`
					: row.title.toLowerCase();
				if (seen.has(key)) continue;
				seen.add(key);
				out.push(row);
				if (out.length >= limit) return out;
			}
		} catch (err) {
			// Multi-source children (actors / streaming) often include empty
			// series catalogs — skip the bad source and keep going.
			const msg = err instanceof Error ? err.message : String(err);
			errors.push(`${source.catalogId}: ${msg}`);
			console.warn(
				`  ⚠ skip source ${source.catalogId} on "${item.title}": ${msg}`,
			);
		}
	}
	if (!out.length) {
		throw new Error(
			`No items for "${item.title}"` +
				(errors.length ? ` (${errors.join("; ")})` : ""),
		);
	}
	return out;
}

function primaryMediaType(item: FusionAddonWidgetItem): MediaType {
	const hasSeries = item.sources.some(
		(s) => s.type === "series" || s.catalogId.startsWith("series::"),
	);
	const hasMovie = item.sources.some(
		(s) => s.type === "movie" || s.catalogId.startsWith("movie::"),
	);
	// Mixed (streaming / some actors): prefer tv like existing fusion streaming
	if (hasSeries && hasMovie) return "tv";
	if (hasSeries && !hasMovie) return "tv";
	return "movie";
}

/** Publish all children of a fusion addonCatalog widget export. */
export async function publishFusionAddonWidgetBlocks(opts: {
	submissionId: string;
	language: string;
	blockIdPrefix: string;
	sourceUrl: string;
	/** Max items per child snapshot (default 100). */
	limit?: number;
	/** Only first N children (for smoke tests). */
	childLimit?: number;
}): Promise<
	Array<{
		blockId: string;
		label: string;
		image?: string;
		imageAspect?: string;
		mediaType: MediaType;
	}>
> {
	const items = await fetchFusionAddonWidgetItems(opts.sourceUrl);
	const slice = opts.childLimit ? items.slice(0, opts.childLimit) : items;
	const limit = opts.limit ?? DEFAULT_LIMIT;
	const children: Array<{
		blockId: string;
		label: string;
		image?: string;
		imageAspect?: string;
		mediaType: MediaType;
	}> = [];
	let failed = false;

	for (const item of slice) {
		const blockId = `${opts.blockIdPrefix}-${fusionBlockSuffix(item.title)}`;
		const mediaType = primaryMediaType(item);
		try {
			await publishBlock({
				submissionId: opts.submissionId,
				blockId,
				mediaType,
				language: opts.language,
				useTmdbTitle: true,
				fetchItems: () => fetchChildItems(item, limit),
			});
			children.push({
				blockId,
				label: item.title,
				mediaType,
				...(item.imageURL ? { image: item.imageURL } : {}),
				...(item.imageAspect ? { imageAspect: item.imageAspect } : {}),
			});
		} catch (error) {
			failed = true;
			console.error(`✗ ${blockId} failed:`, error);
		}
	}
	if (failed) process.exit(1);
	return children;
}

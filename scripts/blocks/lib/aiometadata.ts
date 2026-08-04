/**
 * Fetch items from an AIOMetadata / Stremio catalog (MDBList, Trakt list, custom).
 *
 * Catalog IDs come from fusion widget exports as e.g. `movie::mdblist.159441`
 * or bare `custom.pw_…`. Metas usually carry `_tmdbId`, so publish skips search.
 */

import type { PublishItem } from "../../../src/blocks/publish.js";
import type { MediaType } from "../../../src/blocks/types.js";

export const DEFAULT_AIO_ADDON_BASE =
	"https://aiometadata.1773438.xyz/stremio/b22f870a-a01f-4fd5-855b-e948924123f8";

const PAGE_SIZE = 20;
const DEFAULT_MAX_ITEMS = 100;
const UA =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface AioCatalogRef {
	/** Stremio path segment: movie | series */
	stremioType: "movie" | "series";
	/** Catalog id without type:: prefix, e.g. mdblist.159441 */
	catalogId: string;
}

interface StremioMeta {
	id?: string;
	type?: string;
	name?: string;
	year?: number | string;
	releaseInfo?: string;
	_tmdbId?: number | string;
	imdb_id?: string;
}

/** Parse fusion `catalogId` + `type` into a stremio catalog path. */
export function parseAioCatalogRef(
	catalogId: string,
	type?: string,
): AioCatalogRef {
	const raw = catalogId.trim();
	let stremioType: "movie" | "series" =
		type === "series" || type === "tv" ? "series" : "movie";
	let id = raw;

	const prefixed = raw.match(/^(movie|series|all)::(.+)$/i);
	if (prefixed) {
		const kind = prefixed[1].toLowerCase();
		id = prefixed[2];
		if (kind === "movie") stremioType = "movie";
		else if (kind === "series") stremioType = "series";
		// all:: keep type from payload (often wrong); default movie for film lists
		else if (kind === "all" && !type) stremioType = "movie";
	}

	// Mission: Impossible etc. use type=series with movie trakt lists
	if (id.startsWith("trakt.list.") && type === "series") {
		// Prefer movie path first; caller may retry
	}

	return { stremioType, catalogId: id };
}

function parseYear(meta: StremioMeta): number | undefined {
	if (typeof meta.year === "number" && meta.year > 1800) return meta.year;
	if (typeof meta.year === "string") {
		const n = Number.parseInt(meta.year, 10);
		if (n > 1800) return n;
	}
	const info = meta.releaseInfo?.match(/\d{4}/);
	if (info) return Number.parseInt(info[0], 10);
	return undefined;
}

function metaToItem(meta: StremioMeta): PublishItem | null {
	const title = meta.name?.trim();
	if (!title) return null;
	const tmdbRaw = meta._tmdbId;
	const tmdbId =
		typeof tmdbRaw === "number"
			? tmdbRaw
			: typeof tmdbRaw === "string" && /^\d+$/.test(tmdbRaw)
				? Number.parseInt(tmdbRaw, 10)
				: undefined;
	const mediaType: MediaType | undefined =
		meta.type === "series" ? "tv" : meta.type === "movie" ? "movie" : undefined;
	const year = parseYear(meta);
	return {
		title,
		...(tmdbId ? { tmdbId } : {}),
		...(mediaType ? { mediaType } : {}),
		...(year ? { year } : {}),
	};
}

async function fetchPage(
	addonBase: string,
	stremioType: "movie" | "series",
	catalogId: string,
	skip: number,
): Promise<StremioMeta[]> {
	const path =
		skip > 0
			? `/catalog/${stremioType}/${catalogId}/skip=${skip}.json`
			: `/catalog/${stremioType}/${catalogId}.json`;
	const url = `${addonBase.replace(/\/$/, "")}${path}`;
	const res = await fetch(url, {
		headers: { "User-Agent": UA, Accept: "application/json" },
	});
	if (!res.ok) {
		throw new Error(`AIOMetadata ${res.status}: ${path}`);
	}
	const data = (await res.json()) as { metas?: StremioMeta[] };
	return data.metas ?? [];
}

/**
 * Paginate a stremio catalog. Falls back movie↔series once if first page empty.
 */
export async function fetchAioMetadataCatalogItems(opts: {
	catalogId: string;
	type?: string;
	limit?: number;
	addonBase?: string;
}): Promise<PublishItem[]> {
	const limit = opts.limit ?? DEFAULT_MAX_ITEMS;
	const addonBase = opts.addonBase ?? DEFAULT_AIO_ADDON_BASE;
	const ref = parseAioCatalogRef(opts.catalogId, opts.type);

	const tryTypes: Array<"movie" | "series"> = [ref.stremioType];
	const other = ref.stremioType === "movie" ? "series" : "movie";
	tryTypes.push(other);

	let stremioType = ref.stremioType;
	let firstPage: StremioMeta[] | null = null;
	let lastErr: unknown;
	for (const t of tryTypes) {
		try {
			const page = await fetchPage(addonBase, t, ref.catalogId, 0);
			if (page.length > 0) {
				stremioType = t;
				firstPage = page;
				break;
			}
		} catch (e) {
			lastErr = e;
		}
	}
	if (!firstPage) {
		throw lastErr instanceof Error
			? lastErr
			: new Error(`Empty catalog ${opts.catalogId}`);
	}

	const items: PublishItem[] = [];
	const seen = new Set<string>();

	const pushMetas = (metas: StremioMeta[]) => {
		for (const meta of metas) {
			const item = metaToItem(meta);
			if (!item) continue;
			const key = item.tmdbId
				? `${item.mediaType ?? ""}:${item.tmdbId}`
				: item.title.toLowerCase();
			if (seen.has(key)) continue;
			seen.add(key);
			items.push(item);
			if (items.length >= limit) return true;
		}
		return false;
	};

	if (pushMetas(firstPage)) return items;

	let skip = firstPage.length;
	while (items.length < limit) {
		const page = await fetchPage(addonBase, stremioType, ref.catalogId, skip);
		if (!page.length) break;
		if (pushMetas(page)) break;
		if (page.length < PAGE_SIZE) break;
		skip += page.length;
		// safety
		if (skip > limit * 3) break;
	}
	return items;
}

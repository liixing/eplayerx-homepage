/**
 * Parser for itsrenoria/fusion-starter-kit widget & collection JSON exports.
 * Widget exports embed Trakt list refs per carousel item; collection exports
 * carry poster/banner image URLs for the collection builder.
 */

export interface FusionTraktItem {
	title: string;
	username: string;
	listSlug: string;
	imageURL?: string;
}

export interface FusionStreamingSource {
	username: string;
	listSlug: string;
	listName?: string;
	itemType: "movies" | "shows";
}

export interface FusionStreamingItem {
	title: string;
	imageURL?: string;
	sources: FusionStreamingSource[];
}

export interface FusionCollectionItem {
	name: string;
	imageURL?: string;
}

/** Trakt-backed franchise entry from a fusion `collections.json` export. */
export interface FusionTraktCollectionEntry {
	name: string;
	username: string;
	listSlug: string;
	imageURL?: string;
}

interface FusionTraktPayload {
	listName?: string;
	listSlug: string;
	traktId?: number;
	username: string;
}

interface FusionWidgetEntry {
	title: string;
	imageURL?: string;
	dataSources?: Array<{ kind: string; payload: FusionTraktPayload }>;
}

interface FusionWidgetExport {
	widgets: Array<{
		dataSource?: {
			kind: string;
			payload?: { items?: FusionWidgetEntry[] };
		};
	}>;
}

interface FusionCollectionExport {
	name: string;
	backgroundImageURL?: string;
	dataSource?: { kind: string; payload?: FusionTraktPayload & Record<string, unknown> };
}

/** Broken tmdbDiscover rows in some exports — map to official Trakt lists. */
const TMDB_DISCOVER_FALLBACKS: Record<
	string,
	{ username: string; listSlug: string }
> = {
	"The Chronicles of Riddick": {
		username: "Trakt",
		listSlug: "the-chronicles-of-riddick-collection",
	},
};

function traktItemType(listSlug: string, listName?: string): "movies" | "shows" {
	const haystack = `${listSlug} ${listName ?? ""}`.toLowerCase();
	return haystack.includes("movie") ? "movies" : "shows";
}

/** Streaming widget items — each platform may carry separate movie + show lists. */
export async function fetchFusionStreamingItems(
	url: string,
): Promise<FusionStreamingItem[]> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Fusion widget fetch error: ${res.status}`);
	const data = (await res.json()) as FusionWidgetExport;
	const items = data.widgets[0]?.dataSource?.payload?.items;
	if (!items?.length) throw new Error("No widget items in fusion export");

	const seen = new Set<string>();
	const out: FusionStreamingItem[] = [];
	for (const item of items) {
		const key = fusionPlatformKey(item.title);
		if (seen.has(key)) continue;
		seen.add(key);

		const sources: FusionStreamingSource[] = [];
		for (const ds of item.dataSources ?? []) {
			if (ds.kind !== "traktList") continue;
			const { username, listSlug, listName } = ds.payload ?? {};
			if (!username || !listSlug) {
				throw new Error(`Missing traktList on item "${item.title}"`);
			}
			sources.push({
				username,
				listSlug,
				listName,
				itemType: traktItemType(listSlug, listName),
			});
		}
		if (!sources.length) {
			throw new Error(`Missing traktList on item "${item.title}"`);
		}
		out.push({ title: item.title, imageURL: item.imageURL, sources });
	}
	return out;
}

/** Items from a fusion widget JSON (each maps to one Trakt public list). */
export async function fetchFusionWidgetItems(
	url: string,
): Promise<FusionTraktItem[]> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Fusion widget fetch error: ${res.status}`);
	const data = (await res.json()) as FusionWidgetExport;
	const items = data.widgets[0]?.dataSource?.payload?.items;
	if (!items?.length) throw new Error("No widget items in fusion export");

	return items.map((item) => {
		const ds = item.dataSources?.find((d) => d.kind === "traktList");
		if (!ds?.payload?.username || !ds.payload.listSlug) {
			throw new Error(`Missing traktList on item "${item.title}"`);
		}
		return {
			title: item.title,
			username: ds.payload.username,
			listSlug: ds.payload.listSlug,
			imageURL: item.imageURL,
		};
	});
}

/** Poster/banner entries from a fusion collection JSON. */
export async function fetchFusionCollectionItems(
	url: string,
): Promise<FusionCollectionItem[]> {
	const entries = await fetchFusionCollectionExport(url);
	return entries.map((e) => ({
		name: e.name,
		imageURL: e.backgroundImageURL,
	}));
}

/** Trakt list refs from a fusion `collections.json` (one franchise per row). */
export async function fetchFusionTraktCollectionEntries(
	url: string,
): Promise<FusionTraktCollectionEntry[]> {
	const entries = await fetchFusionCollectionExport(url);
	return entries.map((entry) => {
		const ds = entry.dataSource;
		if (ds?.kind === "traktList") {
			const { username, listSlug } = ds.payload ?? {};
			if (!username || !listSlug) {
				throw new Error(`Missing traktList payload on "${entry.name}"`);
			}
			return {
				name: entry.name,
				username,
				listSlug,
				imageURL: entry.backgroundImageURL,
			};
		}
		if (ds?.kind === "tmdbDiscover") {
			const fallback = TMDB_DISCOVER_FALLBACKS[entry.name];
			if (!fallback) {
				throw new Error(`Unsupported tmdbDiscover entry "${entry.name}"`);
			}
			return {
				name: entry.name,
				username: fallback.username,
				listSlug: fallback.listSlug,
				imageURL: entry.backgroundImageURL,
			};
		}
		throw new Error(`Unsupported dataSource on "${entry.name}"`);
	});
}

async function fetchFusionCollectionExport(
	url: string,
): Promise<FusionCollectionExport[]> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Fusion collection fetch error: ${res.status}`);
	const entries = (await res.json()) as FusionCollectionExport[];
	if (!entries.length) throw new Error("Empty fusion collection export");
	return entries;
}

/** Stable block id suffix from a fusion item title (e.g. "1960s", "Bafta"). */
export function fusionBlockSuffix(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

// --- AIOMetadata / MDBList addonCatalog widget exports (0-nj/EplayerX) ---

export interface FusionAddonSource {
	catalogId: string;
	/** Stremio media type from the export payload: movie | series */
	type: string;
}

export interface FusionAddonWidgetItem {
	title: string;
	imageURL?: string;
	/** poster | wide | square — maps to collection style */
	imageAspect?: string;
	sources: FusionAddonSource[];
}

interface FusionAddonPayload {
	addonId?: string;
	catalogId?: string;
	type?: string;
	/** Some collection exports use catalogType instead of type. */
	catalogType?: string;
}

interface FusionAddonWidgetEntry {
	title?: string;
	name?: string;
	imageURL?: string;
	backgroundImageURL?: string;
	imageAspect?: string;
	/** Poster | Landscape | … from collection-style exports. */
	layout?: string;
	dataSources?: Array<{ kind: string; payload?: FusionAddonPayload }>;
	dataSource?: { kind: string; payload?: FusionAddonPayload };
}

interface FusionAddonWidgetExport {
	widgets: Array<{
		title?: string;
		dataSource?: {
			kind: string;
			payload?: { items?: FusionAddonWidgetEntry[] };
		};
	}>;
}

/** github.com/…/blob/… image links → raw.githubusercontent.com for R2/clients. */
export function normalizeFusionImageUrl(url?: string): string | undefined {
	if (!url) return undefined;
	const blob = url.match(
		/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+?)(?:\?.*)?$/i,
	);
	if (blob) {
		const [, owner, repo, branch, path] = blob;
		return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
	}
	return url;
}

function layoutToAspect(layout?: string): string | undefined {
	if (!layout) return undefined;
	const l = layout.toLowerCase();
	if (l === "poster") return "poster";
	if (l === "landscape" || l === "wide" || l === "banner") return "wide";
	if (l === "square") return "square";
	return undefined;
}

function entrySources(item: FusionAddonWidgetEntry): FusionAddonSource[] {
	const sources: FusionAddonSource[] = [];
	const list = item.dataSources?.length
		? item.dataSources
		: item.dataSource
			? [item.dataSource]
			: [];
	for (const ds of list) {
		if (ds.kind !== "addonCatalog") continue;
		const catalogId = ds.payload?.catalogId?.trim();
		if (!catalogId) continue;
		const type =
			ds.payload?.type ?? ds.payload?.catalogType ?? "movie";
		sources.push({ catalogId, type });
	}
	return sources;
}

function mapAddonEntries(
	items: FusionAddonWidgetEntry[],
): FusionAddonWidgetItem[] {
	const out: FusionAddonWidgetItem[] = [];
	for (const item of items) {
		const title = (item.title ?? item.name ?? "").trim();
		const sources = entrySources(item);
		if (!sources.length) {
			throw new Error(`Missing addonCatalog on item "${title || "?"}"`);
		}
		if (!title) {
			throw new Error("Addon catalog entry missing title/name");
		}
		const imageURL = normalizeFusionImageUrl(
			item.imageURL ?? item.backgroundImageURL,
		);
		const imageAspect =
			item.imageAspect ?? layoutToAspect(item.layout);
		out.push({
			title,
			...(imageURL ? { imageURL } : {}),
			...(imageAspect ? { imageAspect } : {}),
			sources,
		});
	}
	return out;
}

/**
 * Items from a fusion export backed by Stremio addonCatalog (MDBList etc.).
 * Accepts either a full fusionWidgets export or a flat collection array
 * (e.g. 0-nj/EplayerX Genres — each row has name + dataSources).
 */
export async function fetchFusionAddonWidgetItems(
	url: string,
): Promise<FusionAddonWidgetItem[]> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Fusion widget fetch error: ${res.status}`);
	const data = (await res.json()) as
		| FusionAddonWidgetExport
		| FusionAddonWidgetEntry[];

	let items: FusionAddonWidgetEntry[] | undefined;
	if (Array.isArray(data)) {
		items = data;
	} else {
		items = data.widgets[0]?.dataSource?.payload?.items;
	}
	if (!items?.length) throw new Error("No widget items in fusion export");
	return mapAddonEntries(items);
}

/** Map fusion imageAspect to collection style. */
export function fusionAspectToStyle(
	aspect?: string,
): "image-portrait" | "image-landscape" | "image" | undefined {
	switch (aspect) {
		case "poster":
			return "image-portrait";
		case "wide":
			return "image-landscape";
		case "square":
			return "image";
		default:
			return undefined;
	}
}

/** Normalize platform titles so "Hbomax2" dedupes against "Hbomax". */
function fusionPlatformKey(title: string): string {
	return fusionBlockSuffix(title.replace(/\d+$/, ""));
}

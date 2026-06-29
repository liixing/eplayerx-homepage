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

/** Normalize platform titles so "Hbomax2" dedupes against "Hbomax". */
function fusionPlatformKey(title: string): string {
	return fusionBlockSuffix(title.replace(/\d+$/, ""));
}

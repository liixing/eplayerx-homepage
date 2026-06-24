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

export interface FusionCollectionItem {
	name: string;
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
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Fusion collection fetch error: ${res.status}`);
	const entries = (await res.json()) as FusionCollectionExport[];
	if (!entries.length) throw new Error("Empty fusion collection export");
	return entries.map((e) => ({
		name: e.name,
		imageURL: e.backgroundImageURL,
	}));
}

/** Stable block id suffix from a fusion item title (e.g. "1960s", "Bafta"). */
export function fusionBlockSuffix(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

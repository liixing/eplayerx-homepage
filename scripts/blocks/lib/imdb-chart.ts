/**
 * Fetcher for IMDb charts (e.g. /chart/toptv) via the Wayback Machine.
 *
 * imdb.com sits behind an AWS WAF JS challenge, so this reads the latest
 * successful (HTTP 200) archive.org capture instead, which stores the full
 * __NEXT_DATA__ payload with all chart entries and ranks.
 *
 * Entries are mapped to TMDB ids through /3/find/{imdb_id}. `knownIds` pins
 * entries that TMDB models differently from IMDb (separate dub listings,
 * split series, revivals); unmapped entries are logged and skipped.
 */

import type { PublishItem } from "../../../src/blocks/publish.js";

const WAYBACK_CDX = "https://web.archive.org/cdx/search/cdx";

interface ChartEdge {
	currentRank: number;
	node: { id: string; titleText: { text: string } };
}

async function latestCaptureTimestamp(chartUrl: string): Promise<string> {
	const cdx = `${WAYBACK_CDX}?url=${encodeURIComponent(chartUrl)}&filter=statuscode:200&fl=timestamp&limit=-1`;
	const res = await fetch(cdx);
	if (!res.ok) {
		throw new Error(`Wayback CDX error: ${res.status}`);
	}
	const timestamp = (await res.text()).trim().split("\n").pop();
	if (!timestamp) {
		throw new Error(`No 200-status Wayback capture for ${chartUrl}`);
	}
	return timestamp;
}

async function fetchChartEdges(chartUrl: string): Promise<ChartEdge[]> {
	const timestamp = await latestCaptureTimestamp(chartUrl);
	const res = await fetch(
		`https://web.archive.org/web/${timestamp}/https://${chartUrl}`,
	);
	if (!res.ok) {
		throw new Error(`Wayback fetch error: ${res.status}`);
	}
	const html = await res.text();
	const match = html.match(
		/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s,
	);
	if (!match) {
		throw new Error("__NEXT_DATA__ not found in chart page");
	}
	const data = JSON.parse(match[1]);
	const edges = data?.props?.pageProps?.pageData?.chartTitles?.edges as
		| ChartEdge[]
		| undefined;
	if (!edges?.length) {
		throw new Error("chartTitles.edges missing in chart payload");
	}
	console.log(`📊 IMDb chart capture ${timestamp}: ${edges.length} entries`);
	return [...edges].sort((a, b) => a.currentRank - b.currentRank);
}

async function findTvIdByImdbId(imdbId: string): Promise<number | null> {
	const token = process.env.TMDB_API_TOKEN;
	if (!token) {
		throw new Error("TMDB_API_TOKEN is not set; required for /find lookups.");
	}
	const res = await fetch(
		`https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id`,
		{ headers: { Authorization: `Bearer ${token}` } },
	);
	if (!res.ok) return null;
	const data = (await res.json()) as { tv_results?: { id: number }[] };
	return data.tv_results?.[0]?.id ?? null;
}

/** Chart entries in rank order, each carrying a resolved TMDB tv id. */
export async function fetchImdbChartTvItems(
	chartUrl: string,
	knownIds: Record<string, number> = {},
): Promise<PublishItem[]> {
	const edges = await fetchChartEdges(chartUrl);
	const items: PublishItem[] = [];
	for (const edge of edges) {
		const imdbId = edge.node.id;
		const title = edge.node.titleText.text;
		const tmdbId = knownIds[imdbId] ?? (await findTvIdByImdbId(imdbId));
		if (!tmdbId) {
			console.log(`⚠️ No TMDB match for ${imdbId} (${title}); skipped`);
			continue;
		}
		items.push({ title, tmdbId });
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
	return items;
}

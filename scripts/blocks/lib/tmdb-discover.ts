/**
 * TMDB /discover fetcher for network- or company-scoped popular lists.
 * Results already carry TMDB ids, so publishing skips title search.
 */

import type { MediaType } from "../../../src/blocks/types.js";
import type { PublishItem } from "../../../src/blocks/publish.js";

interface DiscoverResult {
	id: number;
	title?: string;
	name?: string;
	poster_path?: string | null;
}

interface DiscoverResponse {
	results?: DiscoverResult[];
}

export interface DiscoverFilter {
	with_networks?: number;
	with_companies?: number;
	sortBy?: string;
}

/** Popular titles from TMDB discover, one page by default (20 items). */
export async function fetchTmdbDiscoverItems(
	token: string,
	mediaType: MediaType,
	filter: DiscoverFilter,
	language: string,
	maxPages = 1,
): Promise<PublishItem[]> {
	const items: PublishItem[] = [];
	for (let page = 1; page <= maxPages; page++) {
		const params = new URLSearchParams({
			language,
			sort_by: filter.sortBy ?? "popularity.desc",
			page: String(page),
		});
		if (filter.with_networks != null) {
			params.set("with_networks", String(filter.with_networks));
		}
		if (filter.with_companies != null) {
			params.set("with_companies", String(filter.with_companies));
		}

		const url = `https://api.themoviedb.org/3/discover/${mediaType}?${params}`;
		const res = await fetch(url, {
			headers: { Authorization: `Bearer ${token}` },
		});
		if (!res.ok) {
			throw new Error(`TMDB discover error: ${res.status}`);
		}
		const data = (await res.json()) as DiscoverResponse;
		const rows = data.results ?? [];
		for (const row of rows) {
			if (!row.poster_path) continue;
			const title = row.title ?? row.name;
			if (!title) continue;
			items.push({ title, tmdbId: row.id, mediaType });
		}
		if (rows.length < 20) break;
	}
	return items;
}

/** Fetch submitter TMDB token via admin API (same as publish.ts). */
export async function fetchSubmitterToken(
	submissionId: string,
): Promise<string> {
	const password = process.env.BLOCKS_ADMIN_PASSWORD;
	if (!password) {
		throw new Error("BLOCKS_ADMIN_PASSWORD is not set");
	}
	const base = process.env.API_BASE_URL || "https://api.eplayerx.com";
	const res = await fetch(new URL(`/admin/api/token/${submissionId}`, base), {
		headers: { Authorization: `Bearer ${password}` },
	});
	if (!res.ok) {
		throw new Error(`token fetch failed (HTTP ${res.status})`);
	}
	const { token } = (await res.json()) as { token?: string };
	if (!token) throw new Error(`submission ${submissionId} has no TMDB token`);
	return token;
}

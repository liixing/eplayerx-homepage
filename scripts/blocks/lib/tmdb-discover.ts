/**
 * TMDB /discover fetcher for network- or company-scoped popular lists.
 * Results already carry TMDB ids, so publishing skips title search.
 */

import type { PublishItem } from "../../../src/blocks/publish.js";
import type { MediaType } from "../../../src/blocks/types.js";

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
	/** Comma-joined genre ids (AND). */
	with_genres?: string;
	/** Comma-joined keyword ids (AND). */
	with_keywords?: string;
	sortBy?: string;
	/** Minimum runtime in minutes (movies). Drops one-shots and featurettes. */
	runtimeGte?: number;
	/** Comma-joined genre ids to exclude. */
	withoutGenres?: string;
	voteCountGte?: number;
	voteAverageGte?: number;
	withOriginalLanguage?: string;
	firstAirDateGte?: string;
	firstAirDateLte?: string;
	/** US-style certs such as `TV-PG|TV-14|TV-MA`. */
	certificationCountry?: string;
	certification?: string;
	watchRegion?: string;
	/** Pipe-joined provider ids for `watchRegion`. */
	withWatchProviders?: string;
	withWatchMonetizationTypes?: string;
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
		if (filter.with_genres) {
			params.set("with_genres", filter.with_genres);
		}
		if (filter.with_keywords) {
			params.set("with_keywords", filter.with_keywords);
		}
		const extra: Record<string, string | number | undefined> = {
			"with_runtime.gte": filter.runtimeGte,
			without_genres: filter.withoutGenres,
			"vote_count.gte": filter.voteCountGte,
			"vote_average.gte": filter.voteAverageGte,
			with_original_language: filter.withOriginalLanguage,
			"first_air_date.gte": filter.firstAirDateGte,
			"first_air_date.lte": filter.firstAirDateLte,
			certification_country: filter.certificationCountry,
			certification: filter.certification,
			watch_region: filter.watchRegion,
			with_watch_providers: filter.withWatchProviders,
			with_watch_monetization_types: filter.withWatchMonetizationTypes,
		};
		for (const [key, value] of Object.entries(extra)) {
			if (value != null && value !== "") params.set(key, String(value));
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

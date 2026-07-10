/**
 * Parser for Tsarinkov Anime-Genre Fusion widget exports (tmdbDiscover rows).
 */

import type { PublishItem } from "../../../src/blocks/publish.js";
import { fusionBlockSuffix } from "./fusion.js";
import {
	fetchTmdbDiscoverItems,
	type DiscoverFilter,
} from "./tmdb-discover.js";

export const ANIME_GENRE_SOURCE_URL =
	"https://raw.githubusercontent.com/Tsarinkov/Anime-Genre/refs/heads/main/Anime-genre-collections.json";
export const ANIME_GENRE_BLOCK_PREFIX = "community-ar-anime-genre";

interface DiscoverSource {
	type: "movie" | "tv";
	includeGenres?: number[];
	includeKeywords?: number[];
	sortBy?: string;
}

export interface AnimeGenreEntry {
	title: string;
	imageURL?: string;
	sources: DiscoverSource[];
}

interface FusionDiscoverPayload {
	type?: "movie" | "tv";
	includeGenres?: number[];
	includeKeywords?: number[];
	sortBy?: string;
}

interface FusionWidgetExport {
	widgets?: Array<{
		dataSource?: {
			payload?: {
				items?: Array<{
					title?: string;
					imageURL?: string;
					dataSources?: Array<{
						kind?: string;
						payload?: FusionDiscoverPayload;
					}>;
				}>;
			};
		};
	}>;
}

export async function fetchAnimeGenreEntries(
	url: string = ANIME_GENRE_SOURCE_URL,
): Promise<AnimeGenreEntry[]> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Anime genre fetch error: ${res.status}`);
	const data = (await res.json()) as FusionWidgetExport;
	const items = data.widgets?.[0]?.dataSource?.payload?.items;
	if (!items?.length) throw new Error("No genre items in export");

	return items.map((item) => {
		const title = item.title?.trim();
		if (!title) throw new Error("Genre item missing title");
		const sources: DiscoverSource[] = [];
		for (const ds of item.dataSources ?? []) {
			if (ds.kind !== "tmdbDiscover") continue;
			const p = ds.payload ?? {};
			if (p.type !== "movie" && p.type !== "tv") continue;
			sources.push({
				type: p.type,
				includeGenres: p.includeGenres,
				includeKeywords: p.includeKeywords,
				sortBy: p.sortBy,
			});
		}
		if (!sources.length) {
			throw new Error(`No tmdbDiscover sources on "${title}"`);
		}
		return {
			title,
			...(item.imageURL ? { imageURL: item.imageURL } : {}),
			sources,
		};
	});
}

export function animeGenreBlockId(
	title: string,
	prefix = ANIME_GENRE_BLOCK_PREFIX,
): string {
	return `${prefix}-${fusionBlockSuffix(title)}`;
}

function toDiscoverFilter(source: DiscoverSource): DiscoverFilter {
	return {
		...(source.includeGenres?.length
			? { with_genres: source.includeGenres.join(",") }
			: {}),
		...(source.includeKeywords?.length
			? { with_keywords: source.includeKeywords.join(",") }
			: {}),
		sortBy: source.sortBy ?? "popularity.desc",
	};
}

/** Merge movie+tv discover pages for one genre entry (dedupe by mediaType:id). */
export async function fetchAnimeGenreItems(
	token: string,
	entry: AnimeGenreEntry,
	language: string,
): Promise<PublishItem[]> {
	const seen = new Set<string>();
	const out: PublishItem[] = [];
	for (const source of entry.sources) {
		const rows = await fetchTmdbDiscoverItems(
			token,
			source.type,
			toDiscoverFilter(source),
			language,
		);
		for (const row of rows) {
			const key = `${row.mediaType ?? source.type}:${row.tmdbId}`;
			if (seen.has(key)) continue;
			seen.add(key);
			out.push({ ...row, mediaType: source.type });
		}
	}
	return out;
}

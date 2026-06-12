/**
 * Shared TMDB enrichment helpers: title search + artwork meta
 * (thumb / logo / clean poster). Used by the scheduled crawlers and
 * the local community-block publishing pipeline (src/blocks/publish.ts).
 */

import { type createTmdbClient, tmdb } from "../tmdb/client.js";

/** TMDB TV genre id for Animation (see /3/genre/tv/list). */
export const TMDB_TV_GENRE_ANIMATION = 16;

/**
 * Defaults to the env-token client; pass a per-user client (createTmdbClient)
 * to spread requests across tokens, e.g. the submitter's token for blocks.
 */
export type TmdbClient = ReturnType<typeof createTmdbClient>;

export interface SearchTmdbOptions {
	language?: string;
	/**
	 * TV search: use first result that includes all of these genre ids (e.g. Animation only).
	 */
	requireTvGenreIds?: number[];
	/**
	 * Movie search: require a release year within ±1 of this (disambiguates
	 * remakes while tolerating premiere/wide-release year offsets).
	 */
	year?: number;
}

export interface TmdbSearchResult {
	id?: number;
	title?: string;
	name?: string;
	vote_average?: number;
	poster_path?: string | null;
	backdrop_path?: string | null;
	genre_ids?: number[];
	release_date?: string | null;
	first_air_date?: string | null;
	overview?: string | null;
}

export interface ImageMeta {
	thumb: string | null;
	logo: string | null;
	noLogoPoster: string | null;
}

type ImageEntry = {
	iso_639_1?: string | null;
	iso_3166_1?: string;
	file_path?: string;
	vote_average?: number;
};

function bestByVote(items: ImageEntry[]) {
	return items.length
		? items.sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))[0]
		: undefined;
}

export async function searchTMDB(
	title: string,
	type: "movie" | "tv",
	options: SearchTmdbOptions = {},
	client: TmdbClient = tmdb,
): Promise<TmdbSearchResult | null> {
	const language = options.language ?? "zh-CN";
	try {
		const path = type === "movie" ? "/3/search/movie" : "/3/search/multi";
		const result = await client.GET(path, {
			params: {
				query: {
					query: title,
					language,
				},
			},
		});

		const rawResults = (result.data?.results ?? []) as TmdbSearchResult[];
		let results =
			type === "tv"
				? rawResults.filter(
						(item) => (item as { media_type?: string }).media_type === "tv",
					)
				: rawResults;
		if (type === "movie" && options.year) {
			const want = options.year;
			results = results.filter((item) => {
				const year = Number.parseInt(
					(item.release_date ?? "").slice(0, 4),
					10,
				);
				return Number.isFinite(year) && Math.abs(year - want) <= 1;
			});
		}
		if (results.length === 0) {
			return null;
		}

		if (type === "tv" && options.requireTvGenreIds?.length) {
			const need = options.requireTvGenreIds;
			for (const r of results) {
				const gids = r.genre_ids ?? [];
				if (need.every((id) => gids.includes(id))) {
					return r;
				}
			}
			return null;
		}

		return results[0];
	} catch (error) {
		console.error(`TMDB search error for "${title}":`, error);
		return null;
	}
}

export async function fetchImageMeta(
	tmdbId: number,
	mediaType: "movie" | "tv",
	backdropPath?: string | null,
	posterPath?: string | null,
	client: TmdbClient = tmdb,
): Promise<ImageMeta> {
	const fallback: ImageMeta = {
		thumb: backdropPath || posterPath || null,
		logo: null,
		noLogoPoster: posterPath ?? null,
	};

	try {
		const result =
			mediaType === "movie"
				? await client.GET(`/3/movie/${tmdbId}/images`, {
						params: { path: { movie_id: tmdbId } },
					})
				: await client.GET(`/3/tv/${tmdbId}/images`, {
						params: { path: { series_id: tmdbId } },
					});

		const images = result.data;

		const backdrops = (images?.backdrops ?? []) as ImageEntry[];
		const thumb =
			backdrops.find((b) => b.iso_639_1 === "zh")?.file_path ||
			backdrops.find((b) => b.iso_639_1 === "en")?.file_path ||
			backdrops.find((b) => b.iso_639_1 === null)?.file_path ||
			backdrops[0]?.file_path ||
			backdropPath ||
			posterPath ||
			null;

		const logos = (images?.logos ?? []) as ImageEntry[];
		let logo: string | null = null;
		if (logos.length) {
			const regionMatches = logos.filter(
				(l) => l.iso_639_1 === "zh" && l.iso_3166_1 === "CN",
			);
			const langMatches = logos.filter((l) => l.iso_639_1 === "zh");
			const best =
				bestByVote(regionMatches) ??
				bestByVote(langMatches) ??
				bestByVote(logos);
			logo = best?.file_path ?? null;
		}

		const posters = (images?.posters ?? []) as ImageEntry[];
		// No textless poster available: fall back to the regular poster so
		// clients always have portrait art instead of a null slot.
		const noLogoPoster =
			bestByVote(posters.filter((p) => !p.iso_639_1))?.file_path ??
			posterPath ??
			null;

		return { thumb, logo, noLogoPoster };
	} catch (error) {
		console.error(`Failed to fetch images for ${mediaType}/${tmdbId}:`, error);
		return fallback;
	}
}

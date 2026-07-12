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

export interface ExternalIds {
	imdbId: string | null;
	tvdbId: number | null;
}

interface TmdbImagesPayload {
	backdrops?: ImageEntry[];
	logos?: ImageEntry[];
	posters?: ImageEntry[];
}

interface TmdbDetailsPayload extends TmdbSearchResult {
	genres?: { id: number }[];
	imdb_id?: unknown;
	tvdb_id?: unknown;
	external_ids?: { imdb_id?: unknown; tvdb_id?: unknown };
	images?: TmdbImagesPayload;
}

function normalizeImdbId(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function normalizeTvdbId(value: unknown): number | null {
	const n =
		typeof value === "number" ? value : Number.parseInt(String(value), 10);
	return Number.isFinite(n) && n > 0 ? n : null;
}

/** Read imdb/tvdb from TMDB details or external_ids payloads. */
export function externalIdsFromPayload(
	mediaType: "movie" | "tv",
	payload: {
		imdb_id?: unknown;
		tvdb_id?: unknown;
		external_ids?: { imdb_id?: unknown; tvdb_id?: unknown };
	},
): ExternalIds {
	const nested = payload.external_ids;
	const imdb = payload.imdb_id ?? nested?.imdb_id;
	const tvdb = mediaType === "tv" ? (payload.tvdb_id ?? nested?.tvdb_id) : null;
	return {
		imdbId: normalizeImdbId(imdb),
		tvdbId: normalizeTvdbId(tvdb),
	};
}

function preferredImageRegion(language: string, languageCode: string) {
	if (languageCode !== "zh") return undefined;
	return language.includes("TW") ? "TW" : "CN";
}

function imageMetaFromImagesPayload(
	images: TmdbImagesPayload | undefined,
	language: string,
	backdropPath?: string | null,
	posterPath?: string | null,
): ImageMeta {
	const fallback: ImageMeta = {
		thumb: backdropPath || posterPath || null,
		logo: null,
		noLogoPoster: posterPath ?? null,
	};
	if (!images) return fallback;

	const languageCode = language.split("-")[0] || "zh";
	const preferredRegion = preferredImageRegion(language, languageCode);

	const backdrops = images.backdrops ?? [];
	const thumb =
		backdrops.find((b) => b.iso_639_1 === languageCode)?.file_path ||
		(languageCode !== "en"
			? backdrops.find((b) => b.iso_639_1 === "en")?.file_path
			: undefined) ||
		backdrops.find((b) => b.iso_639_1 === null)?.file_path ||
		backdrops[0]?.file_path ||
		backdropPath ||
		posterPath ||
		null;

	const logos = images.logos ?? [];
	let logo: string | null = null;
	if (logos.length) {
		const regionMatches = preferredRegion
			? logos.filter(
					(l) =>
						l.iso_639_1 === languageCode &&
						l.iso_3166_1 === preferredRegion,
				)
			: [];
		const langMatches = logos.filter((l) => l.iso_639_1 === languageCode);
		const best =
			bestByVote(regionMatches) ??
			bestByVote(langMatches) ??
			bestByVote(logos);
		logo = best?.file_path ?? null;
	}

	const posters = images.posters ?? [];
	const noLogoPoster =
		bestByVote(posters.filter((p) => !p.iso_639_1))?.file_path ??
		posterPath ??
		null;

	return { thumb, logo, noLogoPoster };
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
	language = "zh-CN",
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

		return imageMetaFromImagesPayload(
			result.data as TmdbImagesPayload | undefined,
			language,
			backdropPath,
			posterPath,
		);
	} catch (error) {
		console.error(`Failed to fetch images for ${mediaType}/${tmdbId}:`, error);
		return fallback;
	}
}

/** Lightweight lookup for one-time backfills (no details/images). */
export async function fetchExternalIds(
	tmdbId: number,
	mediaType: "movie" | "tv",
	client: TmdbClient = tmdb,
): Promise<ExternalIds> {
	try {
		const result =
			mediaType === "movie"
				? await client.GET(`/3/movie/${tmdbId}/external_ids`, {
						params: { path: { movie_id: tmdbId } },
					})
				: await client.GET(`/3/tv/${tmdbId}/external_ids`, {
						params: { path: { series_id: tmdbId } },
					});
		return externalIdsFromPayload(
			mediaType,
			(result.data as TmdbDetailsPayload | undefined) ?? {},
		);
	} catch (error) {
		console.error(
			`Failed to fetch external ids for ${mediaType}/${tmdbId}:`,
			error,
		);
		return { imdbId: null, tvdbId: null };
	}
}

/**
 * One TMDB details call with appended images (+ external_ids for TV).
 * Replaces a separate /images request during publish/crawl.
 */
export async function fetchDetailsWithEnrichment(
	tmdbId: number,
	mediaType: "movie" | "tv",
	language: string | undefined,
	client: TmdbClient = tmdb,
): Promise<{
	tmdbData: TmdbSearchResult;
	externalIds: ExternalIds;
	imageMeta: ImageMeta;
} | null> {
	const lang = language ?? "zh-CN";
	// language filters appended images; include en + null so thumb/logo
	// fallbacks in imageMetaFromImagesPayload can actually see them.
	const langCode = lang.split("-")[0] || "zh";
	const includeImageLanguage = [...new Set([langCode, "en", "null"])].join(
		",",
	);
	try {
		// include_image_language is valid with append_to_response=images but
		// missing from the generated details OpenAPI query types.
		const query = {
			language: lang,
			append_to_response:
				mediaType === "tv" ? "external_ids,images" : "images",
			include_image_language: includeImageLanguage,
		} as {
			language: string;
			append_to_response: string;
			include_image_language: string;
		};
		const result =
			mediaType === "movie"
				? await client.GET(`/3/movie/${tmdbId}`, {
						params: { path: { movie_id: tmdbId }, query },
					})
				: await client.GET(`/3/tv/${tmdbId}`, {
						params: { path: { series_id: tmdbId }, query },
					});
		const data = result.data as TmdbDetailsPayload | undefined;
		if (!data?.id) return null;

		return {
			tmdbData: {
				...data,
				genre_ids: data.genres?.map((g) => g.id) ?? data.genre_ids ?? [],
			},
			externalIds: externalIdsFromPayload(mediaType, data),
			imageMeta: imageMetaFromImagesPayload(
				data.images,
				lang,
				data.backdrop_path,
				data.poster_path,
			),
		};
	} catch (error) {
		console.error(`TMDB details error for ${mediaType}/${tmdbId}:`, error);
		return null;
	}
}

import { trailerCandidates, resolveTrailerCandidates, videoLanguages, type Video } from "../tmdb/trailer-candidates.js";
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

function checkTmdbResponse(response: Response): void {
	if (!response.ok && response.status !== 404) {
		throw new Error(
			`TMDB HTTP ${response.status}; aborting to preserve the existing snapshot.`,
		);
	}
}

export interface SearchTmdbOptions {
	language?: string;
	/**
	 * TV search: use first result that includes all of these genre ids (e.g. Animation only).
	 */
	requireTvGenreIds?: number[];
	/** Match at least one ISO 3166-1 origin country; missing country data is rejected. */
	requireOriginCountries?: string[];
	/**
	 * Movie search: require a release year within ±1 of this (disambiguates
	 * remakes while tolerating premiere/wide-release year offsets).
	 */
	year?: number;
}

export interface TmdbSearchResult {
	trailer?: ReturnType<typeof trailerCandidates>;
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
	original_language?: string | null;
	origin_country?: string[];
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
	videos?: { results?: Video[] };
	genres?: { id: number }[];
	imdb_id?: unknown;
	tvdb_id?: unknown;
	external_ids?: { imdb_id?: unknown; tvdb_id?: unknown };
	images?: TmdbImagesPayload;
	production_countries?: { iso_3166_1?: string }[];
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
	originalLanguage?: string | null,
	originCountries?: string[] | null,
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
	const logo =
		pickPreferredLogo(
			logos,
			languageCode,
			preferredRegion,
			originLanguage(originalLanguage, originCountries),
		)?.file_path ?? null;

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
	aspect_ratio?: number;
	width?: number;
	height?: number;
};

function bestByVote(items: ImageEntry[]) {
	return items.length
		? items.sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))[0]
		: undefined;
}

function logoAspectRatio(logo: ImageEntry): number {
	if (logo.aspect_ratio && logo.aspect_ratio > 0) return logo.aspect_ratio;
	if (logo.width && logo.height && logo.height > 0) {
		return logo.width / logo.height;
	}
	return 0;
}

function isLandscapeLogo(logo: ImageEntry): boolean {
	return logoAspectRatio(logo) > 1;
}

const ORIGIN_COUNTRY_LANGUAGES: Record<string, string> = {
	US: "en",
	GB: "en",
	AU: "en",
	NZ: "en",
	IE: "en",
	CA: "en",
	JP: "ja",
	KR: "ko",
	CN: "zh",
	TW: "zh",
	HK: "zh",
	MO: "zh",
	FR: "fr",
	DE: "de",
	ES: "es",
	MX: "es",
	AR: "es",
	IT: "it",
	BR: "pt",
	PT: "pt",
	RU: "ru",
	NL: "nl",
	SE: "sv",
	NO: "no",
	DK: "da",
	FI: "fi",
	PL: "pl",
	TR: "tr",
	TH: "th",
};

function primaryLanguageCode(raw?: string | null): string | undefined {
	if (!raw) return undefined;
	const trimmed = raw.trim();
	if (!trimmed) return undefined;
	return trimmed.replaceAll("_", "-").split("-")[0]?.toLowerCase();
}

/** TMDB `original_language`, or a language inferred from origin country. */
export function originLanguage(
	originalLanguage?: string | null,
	originCountries?: string[] | null,
): string | undefined {
	const fromTitle = primaryLanguageCode(originalLanguage);
	if (fromTitle) return fromTitle;
	for (const country of originCountries ?? []) {
		const mapped = ORIGIN_COUNTRY_LANGUAGES[country.trim().toUpperCase()];
		if (mapped) return mapped;
	}
	return undefined;
}

function logoLanguageCode(logo: ImageEntry): string | undefined {
	return primaryLanguageCode(logo.iso_639_1);
}

/** App language, then original / origin-country language. Never a random translation. */
export function pickPreferredLogo(
	logos: ImageEntry[],
	languageCode: string,
	preferredRegion?: string,
	originalLanguage?: string,
): ImageEntry | undefined {
	if (!logos.length) return undefined;
	const appLanguage = primaryLanguageCode(languageCode) ?? "en";
	const original = primaryLanguageCode(originalLanguage);
	const landscape = (items: ImageEntry[]) => items.filter(isLandscapeLogo);
	const matching = (language: string | undefined) =>
		logos.filter((logo) => logoLanguageCode(logo) === language);
	const pick = (items: ImageEntry[]) =>
		bestByVote(landscape(items)) ?? bestByVote(items);

	if (appLanguage === "zh" && preferredRegion) {
		const regionMatches = logos.filter(
			(logo) =>
				logoLanguageCode(logo) === "zh" && logo.iso_3166_1 === preferredRegion,
		);
		const regionHit = pick(regionMatches);
		if (regionHit) return regionHit;
	}

	const languages: Array<string | undefined> = [appLanguage];
	if (original && original !== appLanguage) languages.push(original);
	languages.push(undefined);

	const seen = new Set<string>();
	for (const language of languages) {
		const key = language ?? "";
		if (seen.has(key)) continue;
		seen.add(key);
		const hit = pick(matching(language));
		if (hit) return hit;
	}
	return undefined;
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

		checkTmdbResponse(result.response);
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
				const year = Number.parseInt((item.release_date ?? "").slice(0, 4), 10);
				return Number.isFinite(year) && Math.abs(year - want) <= 1;
			});
		}
		if (type === "tv" && options.requireTvGenreIds?.length) {
			const need = options.requireTvGenreIds;
			results = results.filter((r) =>
				need.every((id) => r.genre_ids?.includes(id)),
			);
		}

		const countries = options.requireOriginCountries;
		if (!countries?.length) return results[0] ?? null;
		for (const candidate of results) {
			let origins = candidate.origin_country;
			// Movie search omits origin_country; check details before selecting a hit.
			if (type === "movie" && candidate.id && !origins?.length) {
				const details = await client.GET(`/3/movie/${candidate.id}`, {
					params: { path: { movie_id: candidate.id }, query: { language } },
				});
				checkTmdbResponse(details.response);
				origins = (details.data as TmdbSearchResult | undefined)
					?.origin_country;
			}
			if (countries.some((country) => origins?.includes(country))) {
				return candidate;
			}
		}
		return null;
	} catch (error) {
		console.error(`TMDB search error for "${title}":`, error);
		throw error;
	}
}

export async function fetchImageMeta(
	tmdbId: number,
	mediaType: "movie" | "tv",
	backdropPath?: string | null,
	posterPath?: string | null,
	language = "zh-CN",
	client: TmdbClient = tmdb,
	originalLanguage?: string | null,
	originCountries?: string[] | null,
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
			originalLanguage,
			originCountries,
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
 * One TMDB details call with appended images, trailer metadata and external IDs.
 * Replaces a separate /images request during publish/crawl.
 */
export async function fetchDetailsWithEnrichment(
	tmdbId: number,
	mediaType: "movie" | "tv",
	language: string | undefined,
	client: TmdbClient = tmdb,
	originalLanguage?: string | null,
): Promise<{
	tmdbData: TmdbSearchResult;
	externalIds: ExternalIds;
	imageMeta: ImageMeta;
} | null> {
	const lang = language ?? "zh-CN";
	const langCode = lang.split("-")[0] || "zh";
	const origin = originLanguage(originalLanguage);
	try {
		// include_image_language is valid with append_to_response=images but
		// missing from the generated details OpenAPI query types. If origin
		// is unknown, omit the filter so the same details response still
		// contains origin-language logos.
		const query: {
			language: string;
			append_to_response: string;
			include_image_language?: string;
			include_video_language: string;
		} = {
			language: lang,
			append_to_response: "external_ids,images,videos",
			include_video_language: videoLanguages(lang, originalLanguage),
		};
		if (origin) {
			query.include_image_language = [
				...new Set([langCode, origin, "null"]),
			].join(",");
		}
		const result =
			mediaType === "movie"
				? await client.GET(`/3/movie/${tmdbId}`, {
						params: { path: { movie_id: tmdbId }, query },
					})
				: await client.GET(`/3/tv/${tmdbId}`, {
						params: { path: { series_id: tmdbId }, query },
					});
		checkTmdbResponse(result.response);
		const data = result.data as TmdbDetailsPayload | undefined;
		if (!data?.id) return null;

		return {
			tmdbData: {
				...data,
				...(data.videos ? { trailer: await resolveTrailerCandidates(data, lang, mediaType, query.include_video_language, client).catch(() => undefined) } : {}),
				genre_ids: data.genres?.map((g) => g.id) ?? data.genre_ids ?? [],
			},
			externalIds: externalIdsFromPayload(mediaType, data),
			imageMeta: imageMetaFromImagesPayload(
				data.images,
				lang,
				data.backdrop_path,
				data.poster_path,
				data.original_language ?? originalLanguage,
				[
					...(data.origin_country ?? []),
					...(data.production_countries?.map((c) => c.iso_3166_1 ?? "") ?? []),
				],
			),
		};
	} catch (error) {
		console.error(`TMDB details error for ${mediaType}/${tmdbId}:`, error);
		throw error;
	}
}

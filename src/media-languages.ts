import { cachedRatings, getRatingsCache } from "./ratings/cache.js";
import { resolveTrailerCandidates, videoLanguages, type Details as TrailerDetails } from "./tmdb/trailer-candidates.js";
import type { Context } from "hono";
import { originLanguage, pickPreferredLogo } from "./crawler/tmdb-enrich.js";
import { tmdb } from "./tmdb/client.js";

const languageTag = /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/;
export function languagePreference(value?: string): string | undefined {
  const tag = value?.trim();
  return tag && (tag === "original" || languageTag.test(tag)) ? tag : undefined;
}

export function metadataLanguage(c: Context, fallback = "en"): string {
  const selected = languagePreference(c.req.query("metadataLanguage"));
  return (selected !== "original" ? selected : undefined) || c.req.query("language") || fallback;
}

export function hasMediaLanguages(c: Context): boolean {
  return ["metadataLanguage", "posterLanguage", "logoLanguage"].some(key => !!languagePreference(c.req.query(key)));
}

type Media = Record<string, any>;

/** Optional response overlays never rewrite published snapshots or add work for legacy requests. */
export async function localizeMediaPayload(payload: Media, c: Context, fallbackType?: "movie" | "tv"): Promise<Media> {
  if (!hasMediaLanguages(c)) return payload;
  const preferences = {
    appLanguage: c.req.query("language") || "en-US",
    metadataLanguage: languagePreference(c.req.query("metadataLanguage")),
    posterLanguage: languagePreference(c.req.query("posterLanguage")),
    logoLanguage: languagePreference(c.req.query("logoLanguage")),
  };
  async function localize(item: Media): Promise<Media> {
    const type = item.media_type || fallbackType;
    const id = Number(item.tmdbId ?? item.id);
    if (!["movie", "tv"].includes(type) || !Number.isSafeInteger(id) || id <= 0) return item;
    return (await enrichWithImages([{ ...item, id }], metadataLanguage(c), type, preferences))[0];
  }
  async function walk(value: any): Promise<any> {
    if (Array.isArray(value)) {
      const items: any[] = [];
      for (let offset = 0; offset < value.length; offset += 5) {
        items.push(...await Promise.all(value.slice(offset, offset + 5).map(walk)));
      }
      return items;
    }
    if (!value || typeof value !== "object") return value;
    const containsMedia = ["results", "data", "entries", "items", "cast", "crew", "parts", "children"].some(key => value[key] && typeof value[key] === "object");
    if (!containsMedia && (value.tmdbId || value.id) && (value.media_type || fallbackType) && !(value.networkId || value.languageName)) return localize(value);
    const next = { ...value };
    if (next.children && typeof next.children === "object") {
      if (Array.isArray(next.children)) next.children = await walk(next.children);
      else {
        const children = Object.entries(next.children);
        const values = await walk(children.map(([, child]) => child));
        next.children = Object.fromEntries(children.map(([key], index) => [key, values[index]]));
      }
    }
    for (const key of ["results", "data", "entries", "items", "cast", "crew", "parts"]) {
      if (Array.isArray(next[key])) next[key] = await walk(next[key]);
    }
    return next;
  }
  return walk(payload);
}

/** Keep UI block titles in App language; propagate only explicit preferences to media sources. */
export function configureHomeLanguages(config: Media, c: Context): Media {
  if (!hasMediaLanguages(c)) return config;
  const apply = (block: Media) => {
    if (!["genres-list", "languages-list", "networks-list"].includes(block.preset) && block.source?.path) {
      block.source.query = { ...block.source.query };
      for (const key of ["metadataLanguage", "posterLanguage", "logoLanguage"]) {
        const value = languagePreference(c.req.query(key));
        if (value) block.source.query[key] = value;
      }
    }
    for (const child of block.children || []) apply(child);
  };
  for (const block of config.blocks || []) apply(block);
  return config;
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

function bestByVote<T extends { vote_average?: number }>(items: T[]) {
  return items.length
    ? items.sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))[0]
    : undefined;
}

function withCachedRatings(
  item: Record<string, unknown>,
  mediaType: "movie" | "tv",
  cache: Awaited<ReturnType<typeof getRatingsCache>>,
): Record<string, unknown> {
  const id = Number(item.id);
  if (!Number.isFinite(id) || id <= 0) return item;
  const ratings = cachedRatings(cache, mediaType, id);
  return ratings ? { ...item, ratings } : item;
}

export async function enrichWithImages(
  items: Record<string, unknown>[],
  language: string,
  mediaType?: "movie" | "tv",
  preferences?: { metadataLanguage?: string; posterLanguage?: string; logoLanguage?: string; appLanguage: string }
) {
  const artworkLanguage = preferences?.appLanguage || language;
  const [languageCode] = artworkLanguage.split("-");
  const preferredRegion =
    languageCode === "zh" ? ((preferences ? /hant|tw|hk|mo/i.test(artworkLanguage) : artworkLanguage.includes("TW")) ? "TW" : "CN") : undefined;
  const ratingsCache = getRatingsCache();

  const enrichOne = async (item: Record<string, unknown>) => {
    const type = mediaType ?? (item.media_type as string);
    if (type !== "movie" && type !== "tv") return item;

    const id = item.id as number;
    // Appended metadata replaces the old images call; it does not add an upstream request.
    const query = { language, append_to_response: "images,videos",
      include_image_language: preferences ? undefined : [...new Set([languageCode, originLanguage(
        item.original_language as string | undefined, item.origin_country as string[] | undefined,
      ) ?? "en", "en", "null"])].join(","),
      include_video_language: videoLanguages(language, item.original_language as string | undefined) };
    const imagesPromise = type === "tv"
      ? tmdb.GET(`/3/tv/${id}`, { params: { path: { series_id: id }, query } })
      : tmdb.GET(`/3/movie/${id}`, { params: { path: { movie_id: id }, query } });

    try {
      const [imagesResult, cache] = await Promise.all([
        imagesPromise,
        ratingsCache,
      ]);

      const withRatings = withCachedRatings(item, type, cache);
      if (imagesResult.response.status !== 200) return withRatings;

      const details = imagesResult.data as (TrailerDetails & { images?: { logos?: ImageEntry[]; posters?: ImageEntry[]; backdrops?: ImageEntry[] } }) | undefined;
      const images = details?.images;

      const logos = (images?.logos ?? []) as ImageEntry[];
      const logo = pickPreferredLogo(
        logos,
        languageCode,
        preferredRegion,
        originLanguage(
          item.original_language as string | undefined,
          item.origin_country as string[] | undefined,
        ),
      )?.file_path;

      const posters = (images?.posters ?? []) as ImageEntry[];
      const noLogoPoster = bestByVote(
        posters.filter((p) => !p.iso_639_1)
      )?.file_path;

      const backdrops = (images?.backdrops ?? []) as ImageEntry[];
      const thumb =
        backdrops.find((b) => b.iso_639_1 === languageCode)?.file_path ||
        backdrops.find((b) => b.iso_639_1 === "en")?.file_path ||
        (item.backdrop_path as string | undefined) ||
        (item.poster_path as string | undefined);

      const trailer = details?.videos ? await resolveTrailerCandidates(details, language, type, query.include_video_language).catch(() => undefined) : undefined;
      const next: Record<string, unknown> = { ...withRatings, logo, noLogoPoster, thumb, ...(trailer ? { trailer } : {}) };
      const original = originLanguage((details as Record<string, any> | undefined)?.original_language ?? item.original_language as string | undefined,
        item.origin_country as string[] | undefined);
      const resolve = (value?: string) => value === "original" ? original || artworkLanguage : value || artworkLanguage;
      const region = (tag: string) => /^zh/i.test(tag) ? (/hant|tw|hk|mo/i.test(tag) ? "TW" : "CN") : undefined;
      if (preferences?.metadataLanguage && details) {
        const localized = details as Record<string, any>;
        const title = localized.title || localized.name;
        if (title) {
          if ("name" in item) next.name = title;
          if ("title" in item || !("name" in item)) next.title = title;
        }
        if (localized.overview) next.overview = localized.overview;
      }
      if (preferences?.posterLanguage) {
        const tag = resolve(preferences.posterLanguage);
        const portrait = posters.filter(image => (image.aspect_ratio || (image.width ?? 0) / (image.height ?? 1)) <= 1);
        const path = pickPreferredLogo(portrait, tag, region(tag), original)?.file_path;
        if (path) next.poster_path = path;
      }
      if (preferences) {
        const tag = resolve(preferences.logoLanguage);
        next.logo = pickPreferredLogo(logos, tag, region(tag), original)?.file_path ?? null;
        if ("logo_path" in item) next.logo_path = next.logo;
      }
      return next;
    } catch {
      try {
        return withCachedRatings(item, type, await ratingsCache);
      } catch {
        return item;
      }
    }
  };

  const CONCURRENCY = 5;
  const results: Record<string, unknown>[] = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(enrichOne));
    results.push(...batchResults);
  }
  return results;
}

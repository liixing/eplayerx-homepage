import { Hono, type Context } from "hono";
import { pickPreferredLogo } from "../crawler/tmdb-enrich.js";
import { cachedRatings, getRatingsCache } from "../ratings/cache.js";
import { tmdb } from "./client.js";

const tmdbApp = new Hono();

/** Bump to drop Cache API entries after discover filter changes. */
const TMDB_CACHE_EPOCH = "20260818-videos-all-langs";

const TMDB_IMAGE_CACHE_CONTROL =
  "public, max-age=31536000, s-maxage=31536000, immutable";

function cacheHeader(maxAgeSeconds: number, swrSeconds: number): string {
  return `public, max-age=${maxAgeSeconds}, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${swrSeconds}`;
}

/** Per-surface TTLs — matched to how often TMDB data actually changes. */
const CACHE = {
  /** find, external_ids, genre lists */
  immutable: cacheHeader(2_592_000, 604_800),
  /** poster/backdrop/logo lists */
  artwork: cacheHeader(2_592_000, 604_800),
  /** movie/tv/collection/person details */
  details: cacheHeader(604_800, 86_400),
  /** cast & crew */
  credits: cacheHeader(604_800, 86_400),
  /** recommendations — shift more often than static metadata */
  similar: cacheHeader(86_400, 21_600),
  /** trailers/clips occasionally added */
  videos: cacheHeader(259_200, 43_200),
  /** episode lists for airing shows */
  season: cacheHeader(43_200, 10_800),
  /** filmography pages */
  personCredits: cacheHeader(259_200, 43_200),
  /** popular / top_rated charts */
  charts: cacheHeader(86_400, 21_600),
  /** trending week window */
  trendingWeek: cacheHeader(86_400, 21_600),
  /** trending day window */
  trendingDay: cacheHeader(10_800, 3_600),
  /** release calendars */
  upcoming: cacheHeader(43_200, 10_800),
  onTheAir: cacheHeader(43_200, 10_800),
  /** filtered home-feed discover queries */
  discover: cacheHeader(21_600, 3_600),
  /** same query → same results for a long window */
  search: cacheHeader(86_400, 21_600),
} as const;

function defaultCache(): Cache | null {
  if (typeof caches === "undefined") return null;
  return (caches as unknown as { default?: Cache }).default ?? null;
}

/** Strip the parent mount prefix so matchers work inside `app.route("/tmdb", …)`. */
function tmdbApiPath(rawPath: string): string {
  if (rawPath.startsWith("/tmdb/")) {
    return rawPath.slice("/tmdb".length);
  }
  if (rawPath === "/tmdb") {
    return "/";
  }
  return rawPath;
}

function cacheControlForRequest(c: Context): string | null {
  const path = tmdbApiPath(c.req.path);
  if (path.startsWith("/image/")) return null;

  const url = new URL(c.req.url);

  if (
    path === "/find" ||
    /^\/genre\/(movie|tv)\/list$/.test(path) ||
    /^\/(movie|tv)\/external_ids$/.test(path)
  ) {
    return CACHE.immutable;
  }

  if (/^\/(movie|tv)\/images$/.test(path) || path === "/tv/season/images") {
    return CACHE.artwork;
  }

  if (
    /^\/(movie|tv)\/details$/.test(path) ||
    path === "/collection/details" ||
    path === "/person/details"
  ) {
    return CACHE.details;
  }

  if (/^\/(movie|tv)\/credits$/.test(path)) {
    return CACHE.credits;
  }

  if (/^\/(movie|tv)\/similar$/.test(path)) {
    return CACHE.similar;
  }

  if (/^\/(movie|tv)\/videos$/.test(path)) {
    return CACHE.videos;
  }

  if (path === "/tv/season/details") {
    return CACHE.season;
  }

  if (path === "/person/movie_credits" || path === "/person/tv_credits") {
    return CACHE.personCredits;
  }

  if (/^\/(movie|tv)\/(popular|top_rated)$/.test(path)) {
    return CACHE.charts;
  }

  if (path === "/movie/upcoming") {
    return CACHE.upcoming;
  }

  if (path === "/tv/on_the_air") {
    return CACHE.onTheAir;
  }

  if (path.startsWith("/trending/")) {
    const timeWindow = url.searchParams.get("timeWindow") || "day";
    return timeWindow === "week" ? CACHE.trendingWeek : CACHE.trendingDay;
  }

  if (path.startsWith("/discover/")) {
    return CACHE.discover;
  }

  if (path.startsWith("/search/")) {
    return CACHE.search;
  }

  return null;
}

export async function tmdbCacheMiddleware(c: Context, next: () => Promise<void>) {
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    return next();
  }

  const cacheControl = cacheControlForRequest(c);
  if (!cacheControl) {
    return next();
  }

  const cache = defaultCache();
  const cacheKey = new Request(`${c.req.url}#${TMDB_CACHE_EPOCH}`, {
    method: "GET",
  });
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) {
      const headers = new Headers(hit.headers);
      headers.set("Cache-Control", cacheControl);
      return new Response(c.req.method === "HEAD" ? null : hit.body, {
        status: hit.status,
        headers,
      });
    }
  }

  await next();
  c.header("Cache-Control", cacheControl);
  if (cache && c.req.method === "GET" && c.res.ok) {
    c.executionCtx.waitUntil(cache.put(cacheKey, c.res.clone()));
  }
}

function mergeWithoutGenres(upstream: URL, ids: string[]) {
	const excluded = new Set(
		(upstream.searchParams.get("without_genres") ?? "")
			.split(",")
			.map((id) => id.trim())
			.filter(Boolean),
	);
	for (const id of ids) excluded.add(id);
	upstream.searchParams.set("without_genres", [...excluded].join(","));
}

/** Stale homepage clients still hit the unfiltered ja/es popularity URLs. */
function applyHomepageDramaDefaults(path: string, upstream: URL) {
	if (path !== "/3/discover/tv") return;
	if (upstream.searchParams.get("with_genres") === "16") return;

	const language = upstream.searchParams.get("with_original_language");
	const sort = upstream.searchParams.get("sort_by");

	if (language === "ja") {
		mergeWithoutGenres(upstream, ["16", "10762"]);
		return;
	}

	if (
		language === "es" &&
		sort === "popularity.desc" &&
		!upstream.searchParams.has("with_genres") &&
		!upstream.searchParams.has("vote_count.gte")
	) {
		upstream.searchParams.set("with_genres", "18");
		mergeWithoutGenres(upstream, ["16", "10762", "10764"]);
		upstream.searchParams.set("vote_count.gte", "20");
		if (!upstream.searchParams.has("first_air_date.gte")) {
			upstream.searchParams.set("first_air_date.gte", "2018-01-01");
		}
	}
}

async function proxyTmdbDiscover(c: Context, path: string) {
  if (!process.env.TMDB_API_TOKEN) {
    throw new Error("TMDB_API_TOKEN is not set");
  }

  const requestUrl = new URL(c.req.url);
  const upstream = new URL(
    path,
    process.env.PUBLIC_TMDB_API_BASE_URL || "https://api.themoviedb.org"
  );

  for (const [key, value] of requestUrl.searchParams.entries()) {
    upstream.searchParams.append(key, value);
  }

  applyHomepageDramaDefaults(path, upstream);

  const response = await fetch(upstream, {
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${process.env.TMDB_API_TOKEN}`,
    },
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    return c.json({ error: data }, 500);
  }

  const page = Number.parseInt(requestUrl.searchParams.get("page") || "1", 10);
  const mediaType = path.endsWith("/movie") ? "movie" : "tv";
  if (
    page === 1 &&
    data &&
    typeof data === "object" &&
    Array.isArray((data as { results?: unknown }).results) &&
    (data as { results: unknown[] }).results.length > 0
  ) {
    const results = (data as { results: Record<string, unknown>[] }).results;
    const top = results.slice(0, 20);
    const rest = results.slice(20);
    const rated = await attachListRatings(top, mediaType);
    return c.json({ ...(data as object), results: [...rated, ...rest] });
  }

  return c.json(data);
}

tmdbApp.get("/search/keyword", async (c) => {
  const query = c.req.query("query") || "";
  const page = Number.parseInt(c.req.query("page") || "1");
  const language = c.req.query("language") || "en-US";
  const result = await tmdb.GET("/3/search/multi", {
    params: {
      query: {
        query,
        page,
        language,
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data?.results);
});

tmdbApp.get("/search/person", async (c) => {
  const query = c.req.query("query") || "";
  const page = Number.parseInt(c.req.query("page") || "1", 10);
  const language = c.req.query("language") || "en-US";
  const result = await tmdb.GET("/3/search/person", {
    params: {
      query: {
        query,
        page,
        language,
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data?.results);
});

tmdbApp.get("/genre/tv/list", async (c) => {
  const language = c.req.query("language") || "en";
  const result = await tmdb.GET("/3/genre/tv/list", {
    params: {
      query: {
        language,
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data?.genres || []);
});

tmdbApp.get("/genre/movie/list", async (c) => {
  const language = c.req.query("language") || "en";
  const result = await tmdb.GET("/3/genre/movie/list", {
    params: {
      query: {
        language,
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data?.genres || []);
});

tmdbApp.get("/movie/details", async (c) => {
  const id = c.req.query("id") || "";
  const language = c.req.query("language") || "en";
  const result = await tmdb.GET(`/3/movie/${Number(id)}`, {
    params: {
      query: {
        language,
        append_to_response: "release_dates",
      },
      path: {
        movie_id: Number(id),
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

tmdbApp.get("/movie/images", async (c) => {
  const id = c.req.query("id") || "";
  const result = await tmdb.GET(`/3/movie/${Number(id)}/images`, {
    params: {
      path: {
        movie_id: Number(id),
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

tmdbApp.get("/movie/external_ids", async (c) => {
  const id = c.req.query("id") || "";
  const result = await tmdb.GET(`/3/movie/${Number(id)}/external_ids`, {
    params: {
      path: {
        movie_id: Number(id),
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

tmdbApp.get("/find", async (c) => {
  const id = c.req.query("id") || "";
  const externalSource = c.req.query("external_source") || "imdb_id";
  const language = c.req.query("language");

  if (!id) {
    return c.json({ error: "id is required" }, 400);
  }

  const result = await tmdb.GET(`/3/find/${id}`, {
    params: {
      query: {
        external_source: externalSource as
          | ""
          | "imdb_id"
          | "facebook_id"
          | "instagram_id"
          | "tvdb_id"
          | "tiktok_id"
          | "twitter_id"
          | "wikidata_id"
          | "youtube_id",
        ...(language ? { language } : {}),
      },
      path: {
        external_id: id,
      },
    },
  });

  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

tmdbApp.get("/movie/credits", async (c) => {
  const id = c.req.query("id") || "";
  const language = c.req.query("language") || "en";
  const result = await tmdb.GET(`/3/movie/${Number(id)}/credits`, {
    params: {
      query: {
        language,
      },
      path: {
        movie_id: Number(id),
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

tmdbApp.get("/movie/similar", async (c) => {
  const id = c.req.query("id") || "";
  const language = c.req.query("language") || "en";
  const result = await tmdb.GET(`/3/movie/${Number(id)}/recommendations`, {
    params: {
      query: {
        language,
      },
      path: {
        movie_id: Number(id),
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

/** ISO 639-1 only. Regional tags like zh-CN make TMDB drop other languages. */
const VIDEO_INCLUDE_LANGUAGES =
  "en,zh,ja,ko,fr,de,es,pt,it,ru,ar,hi,th,id,vi,tr,pl,nl,sv,cs,uk,null";
const VIDEO_INCLUDE_LANGUAGE_SET = new Set(VIDEO_INCLUDE_LANGUAGES.split(","));

function videoLanguagePrimary(language: string): string {
  return language.trim().toLowerCase().split(/[-_]/)[0] ?? "";
}

function includeVideoLanguage(language: string): string {
  const primary = videoLanguagePrimary(language);
  if (!primary || VIDEO_INCLUDE_LANGUAGE_SET.has(primary)) {
    return VIDEO_INCLUDE_LANGUAGES;
  }
  return `${primary},${VIDEO_INCLUDE_LANGUAGES}`;
}

function preferClientLanguageVideos<T extends { iso_639_1?: string }>(
  results: T[] | undefined,
  language: string,
): T[] {
  if (!results?.length) return results ?? [];
  const primary = videoLanguagePrimary(language);
  if (!primary) return results;
  const matched: T[] = [];
  const rest: T[] = [];
  for (const video of results) {
    if ((video.iso_639_1 ?? "").toLowerCase() === primary) {
      matched.push(video);
    } else {
      rest.push(video);
    }
  }
  return matched.length === 0 ? results : [...matched, ...rest];
}

tmdbApp.get("/movie/videos", async (c) => {
  const id = c.req.query("id") || "";
  const language = c.req.query("language") || "en";
  const result = await tmdb.GET(`/3/movie/${Number(id)}/videos`, {
    params: {
      // Movie OpenAPI omits include_video_language; TMDB accepts it.
      query: {
        include_video_language: includeVideoLanguage(language),
      } as { language?: string },
      path: {
        movie_id: Number(id),
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  const data = result.data;
  return c.json({
    ...data,
    results: preferClientLanguageVideos(data?.results, language),
  });
});

tmdbApp.get("/movie/popular", async (c) => {
  const language = c.req.query("language") || "en";
  const page = Number.parseInt(c.req.query("page") || "1");
  const result = await tmdb.GET("/3/movie/popular", {
    params: {
      query: {
        language,
        page,
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }

  return c.json(result.data);
});

tmdbApp.get("/movie/top_rated", async (c) => {
  const language = c.req.query("language") || "en";
  const page = Number.parseInt(c.req.query("page") || "1");
  const result = await tmdb.GET("/3/movie/top_rated", {
    params: {
      query: {
        language,
        page,
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  if (page === 1 && result.data?.results?.length) {
    const results = result.data.results as Record<string, unknown>[];
    const top = results.slice(0, 20);
    const rest = results.slice(20);
    const enriched = await enrichWithImages(top, language, "movie");
    return c.json({ ...result.data, results: [...enriched, ...rest] });
  }
  return c.json(result.data);
});

tmdbApp.get("/movie/upcoming", async (c) => {
  const language = c.req.query("language") || "en";
  const region = c.req.query("region") || "US";
  const result = await tmdb.GET("/3/movie/upcoming", {
    params: {
      query: {
        language,
        region,
      },
    },
  });

  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

tmdbApp.get("/collection/details", async (c) => {
  const id = c.req.query("id") || "";
  const language = c.req.query("language") || "en";
  const result = await tmdb.GET(`/3/collection/${Number(id)}`, {
    params: {
      query: {
        language,
      },
      path: {
        collection_id: Number(id),
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

tmdbApp.get("/tv/external_ids", async (c) => {
  const id = c.req.query("id") || "";
  const result = await tmdb.GET(`/3/tv/${Number(id)}/external_ids`, {
    params: {
      path: {
        series_id: Number(id),
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

tmdbApp.get("/tv/details", async (c) => {
  const id = c.req.query("id") || "";
  const language = c.req.query("language") || "en";
  const result = await tmdb.GET(`/3/tv/${Number(id)}`, {
    params: {
      query: {
        language,
        append_to_response: "content_ratings",
      },
      path: {
        series_id: Number(id),
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

tmdbApp.get("/tv/images", async (c) => {
  const id = c.req.query("id") || "";
  const result = await tmdb.GET(`/3/tv/${Number(id)}/images`, {
    params: {
      path: {
        series_id: Number(id),
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

tmdbApp.get("/tv/season/images", async (c) => {
  const id = c.req.query("id") || "";
  const seasonNumber = c.req.query("seasonNumber") || "";
  const result = await tmdb.GET(
    `/3/tv/${Number(id)}/season/${Number(seasonNumber)}/images`,
    {
      params: {
        path: {
          series_id: Number(id),
          season_number: Number(seasonNumber),
        },
      },
    }
  );
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

tmdbApp.get("/tv/season/details", async (c) => {
  const id = c.req.query("id") || "";
  const seasonNumber = c.req.query("seasonNumber") || "";
  const language = c.req.query("language") || "en";
  const result = await tmdb.GET(
    `/3/tv/${Number(id)}/season/${Number(seasonNumber)}`,
    {
      params: {
        query: {
          language,
        },
        path: {
          series_id: Number(id),
          season_number: Number(seasonNumber),
        },
      },
    }
  );
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

tmdbApp.get("/tv/credits", async (c) => {
  const id = c.req.query("id") || "";
  const language = c.req.query("language") || "en";
  const result = await tmdb.GET(`/3/tv/${Number(id)}/credits`, {
    params: {
      query: {
        language,
      },
      path: {
        series_id: Number(id),
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

tmdbApp.get("/tv/similar", async (c) => {
  const id = c.req.query("id") || "";
  const language = c.req.query("language") || "en";
  const result = await tmdb.GET(`/3/tv/${Number(id)}/recommendations`, {
    params: {
      query: {
        language,
      },
      path: {
        series_id: Number(id),
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

tmdbApp.get("/tv/videos", async (c) => {
  const id = c.req.query("id") || "";
  const language = c.req.query("language") || "en";
  const result = await tmdb.GET(`/3/tv/${Number(id)}/videos`, {
    params: {
      query: {
        include_video_language: includeVideoLanguage(language),
      },
      path: {
        series_id: Number(id),
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  const data = result.data;
  return c.json({
    ...data,
    results: preferClientLanguageVideos(data?.results, language),
  });
});

tmdbApp.get("/tv/popular", async (c) => {
  const language = c.req.query("language") || "en";
  const page = Number.parseInt(c.req.query("page") || "1");
  const result = await tmdb.GET("/3/tv/popular", {
    params: {
      query: {
        language,
        page,
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

tmdbApp.get("/tv/top_rated", async (c) => {
  const language = c.req.query("language") || "en";
  const page = Number.parseInt(c.req.query("page") || "1");
  const result = await tmdb.GET("/3/tv/top_rated", {
    params: {
      query: {
        language,
        page,
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  if (page === 1 && result.data?.results?.length) {
    const results = result.data.results as Record<string, unknown>[];
    const top = results.slice(0, 20);
    const rest = results.slice(20);
    const enriched = await enrichWithImages(top, language, "tv");
    return c.json({ ...result.data, results: [...enriched, ...rest] });
  }
  return c.json(result.data);
});

tmdbApp.get("/tv/on_the_air", async (c) => {
  const language = c.req.query("language") || "en";
  const timezone = c.req.query("timezone") || "America/New_York";
  const result = await tmdb.GET("/3/tv/on_the_air", {
    params: {
      query: {
        language,
        timezone,
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  if (result.data?.results?.length) {
    const top = (result.data.results as Record<string, unknown>[]).slice(0, 20);
    const rest = (result.data.results as Record<string, unknown>[]).slice(20);
    const enriched = await enrichWithImages(top, language, "tv");
    return c.json({ ...result.data, results: [...enriched, ...rest] });
  }
  return c.json(result.data);
});

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

/** Ratings only — used by discover lists that skip artwork enrich. */
async function attachListRatings(
  items: Record<string, unknown>[],
  mediaType: "movie" | "tv",
): Promise<Record<string, unknown>[]> {
  const cache = await getRatingsCache();
  return items.map((item) => withCachedRatings(item, mediaType, cache));
}

async function enrichWithImages(
  items: Record<string, unknown>[],
  language: string,
  mediaType?: "movie" | "tv"
) {
  const [languageCode] = language.split("-");
  const preferredRegion =
    languageCode === "zh" ? (language.includes("TW") ? "TW" : "CN") : undefined;
  const ratingsCache = getRatingsCache();

  const enrichOne = async (item: Record<string, unknown>) => {
    const type = mediaType ?? (item.media_type as string);
    if (type !== "movie" && type !== "tv") return item;

    const id = item.id as number;
    const imagesPromise =
      type === "tv"
        ? tmdb.GET(`/3/tv/${id}/images`, {
            params: { path: { series_id: id } },
          })
        : tmdb.GET(`/3/movie/${id}/images`, {
            params: { path: { movie_id: id } },
          });

    try {
      const [imagesResult, cache] = await Promise.all([
        imagesPromise,
        ratingsCache,
      ]);

      const withRatings = withCachedRatings(item, type, cache);
      if (imagesResult.response.status !== 200) return withRatings;

      const images = imagesResult.data;

      const logos = (images?.logos ?? []) as ImageEntry[];
      const logo = pickPreferredLogo(logos, languageCode, preferredRegion)
        ?.file_path;

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

      return { ...withRatings, logo, noLogoPoster, thumb };
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

tmdbApp.get("/trending/all", async (c) => {
  const language = c.req.query("language") || "en";
  const timeWindow: "day" | "week" =
    (c.req.query("timeWindow") as "day" | "week") || "day";
  const result = await tmdb.GET(`/3/trending/all/${timeWindow}`, {
    params: {
      query: {
        language,
      },
      path: {
        time_window: timeWindow,
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

tmdbApp.get("/trending/movie", async (c) => {
  const language = c.req.query("language") || "en";
  const timeWindow: "day" | "week" =
    (c.req.query("timeWindow") as "day" | "week") || "day";
  const page = Number.parseInt(c.req.query("page") || "1");
  const result = await tmdb.GET(`/3/trending/movie/${timeWindow}`, {
    params: {
      query: {
        language,
        page,
      },
      path: {
        time_window: timeWindow,
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  if (page === 1 && result.data?.results?.length) {
    const results = result.data.results as Record<string, unknown>[];
    const top = results.slice(0, 20);
    const rest = results.slice(20);
    const enriched = await enrichWithImages(top, language, "movie");
    return c.json({ ...result.data, results: [...enriched, ...rest] });
  }
  return c.json(result.data);
});

tmdbApp.get("/trending/tv", async (c) => {
  const language = c.req.query("language") || "en";
  const timeWindow: "day" | "week" =
    (c.req.query("timeWindow") as "day" | "week") || "day";
  const page = Number.parseInt(c.req.query("page") || "1");
  const result = await tmdb.GET(`/3/trending/tv/${timeWindow}`, {
    params: {
      query: {
        language,
        page,
      },
      path: {
        time_window: timeWindow,
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }

  if (page === 1 && result.data?.results?.length) {
    const results = result.data.results as Record<string, unknown>[];
    const top = results.slice(0, 20);
    const rest = results.slice(20);
    const enriched = await enrichWithImages(top, language, "tv");
    return c.json({ ...result.data, results: [...enriched, ...rest] });
  }
  return c.json(result.data);
});

tmdbApp.get("/discover/movie", async (c) => {
  return proxyTmdbDiscover(c, "/3/discover/movie");
});

tmdbApp.get("/discover/tv", async (c) => {
  return proxyTmdbDiscover(c, "/3/discover/tv");
});

tmdbApp.get("/person/details", async (c) => {
  const id = c.req.query("id") || "";
  const language = c.req.query("language") || "en";
  const result = await tmdb.GET(`/3/person/${Number(id)}`, {
    params: {
      query: {
        language,
      },
      path: {
        person_id: Number(id),
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

tmdbApp.get("/person/movie_credits", async (c) => {
  const id = c.req.query("id") || "";
  const language = c.req.query("language") || "en";
  const result = await tmdb.GET(`/3/person/${Number(id)}/movie_credits`, {
    params: {
      query: {
        language,
      },
      path: {
        person_id: Number(id),
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

tmdbApp.get("/person/tv_credits", async (c) => {
  const id = c.req.query("id") || "";
  const language = c.req.query("language") || "en";
  const result = await tmdb.GET(`/3/person/${Number(id)}/tv_credits`, {
    params: {
      query: {
        language,
      },
      path: {
        person_id: Number(id),
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

tmdbApp.get("/image/*", async (c) => {
  const url = new URL(c.req.url);
  const match = url.pathname.match(/\/image\/(.+)/);
  const path = match?.[1];

  if (!path) {
    return c.json({ error: "Image path is required" }, 400);
  }

  if (
    path.includes("..") ||
    path.startsWith("//") ||
    /^\s*https?:/i.test(path)
  ) {
    return c.json({ error: "Invalid image path" }, 400);
  }

  // Proxy via Worker (origin may be reachable where image.tmdb.org is not).
  const imageUrl = new URL(path, "https://image.tmdb.org/t/p/").href;
  const onCf =
    (globalThis as { caches?: { default?: unknown } }).caches?.default !==
    undefined;
  const upstream = await fetch(
    imageUrl,
    onCf
      ? ({
          cf: { cacheEverything: true, cacheTtl: 31_536_000 },
        } as RequestInit)
      : undefined
  );
  if (!upstream.ok) {
    return c.json({ error: "Failed to fetch image" }, 502);
  }

  const headers = new Headers();
  const ct = upstream.headers.get("content-type");
  if (ct) {
    headers.set("Content-Type", ct);
  }
  headers.set("Cache-Control", TMDB_IMAGE_CACHE_CONTROL);

  return new Response(upstream.body, { status: upstream.status, headers });
});

export default tmdbApp;

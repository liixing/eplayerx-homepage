import { Hono } from "hono";
import { tmdb } from "./client.js";

const tmdbApp = new Hono();

const TMDB_IMAGE_CACHE_CONTROL =
  "public, max-age=31536000, s-maxage=31536000, immutable";

function workersDefaultCache():
  | {
      match(request: Request): Promise<Response | undefined>;
      put(request: Request, response: Response): Promise<void>;
    }
  | undefined {
  const w = globalThis as typeof globalThis & {
    caches?: {
      default: {
        match(request: Request): Promise<Response | undefined>;
        put(request: Request, response: Response): Promise<void>;
      };
    };
  };
  return w.caches?.default;
}

// Movie sort_by type and validation
type MovieSortBy =
  | "original_title.asc"
  | "original_title.desc"
  | "popularity.asc"
  | "popularity.desc"
  | "revenue.asc"
  | "revenue.desc"
  | "primary_release_date.asc"
  | "title.asc"
  | "title.desc"
  | "primary_release_date.desc"
  | "vote_average.asc"
  | "vote_average.desc"
  | "vote_count.asc"
  | "vote_count.desc";

const VALID_MOVIE_SORT_BY_VALUES: readonly MovieSortBy[] = [
  "original_title.asc",
  "original_title.desc",
  "popularity.asc",
  "popularity.desc",
  "revenue.asc",
  "revenue.desc",
  "primary_release_date.asc",
  "title.asc",
  "title.desc",
  "primary_release_date.desc",
  "vote_average.asc",
  "vote_average.desc",
  "vote_count.asc",
  "vote_count.desc",
] as const;

function isValidMovieSortBy(value: string | undefined): value is MovieSortBy {
  return (
    value !== undefined &&
    VALID_MOVIE_SORT_BY_VALUES.includes(value as MovieSortBy)
  );
}

// TV sort_by type and validation
type TvSortBy =
  | "popularity.asc"
  | "popularity.desc"
  | "vote_average.asc"
  | "vote_average.desc"
  | "vote_count.asc"
  | "vote_count.desc"
  | "first_air_date.asc"
  | "first_air_date.desc"
  | "name.asc"
  | "name.desc"
  | "original_name.asc"
  | "original_name.desc";

const VALID_TV_SORT_BY_VALUES: readonly TvSortBy[] = [
  "popularity.asc",
  "popularity.desc",
  "vote_average.asc",
  "vote_average.desc",
  "vote_count.asc",
  "vote_count.desc",
  "first_air_date.asc",
  "first_air_date.desc",
  "name.asc",
  "name.desc",
  "original_name.asc",
  "original_name.desc",
] as const;

function isValidTvSortBy(value: string | undefined): value is TvSortBy {
  return (
    value !== undefined && VALID_TV_SORT_BY_VALUES.includes(value as TvSortBy)
  );
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

tmdbApp.get("/movie/videos", async (c) => {
  const id = c.req.query("id") || "";
  const language = c.req.query("language") || "en";
  const result = await tmdb.GET(`/3/movie/${Number(id)}/videos`, {
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
    const first10 = (result.data.results as Record<string, unknown>[]).slice(
      0,
      10
    );
    const rest = (result.data.results as Record<string, unknown>[]).slice(10);
    const enriched = await enrichWithImages(first10, language, "tv");
    return c.json({ ...result.data, results: [...enriched, ...rest] });
  }
  return c.json(result.data);
});

type ImageEntry = {
  iso_639_1?: string | null;
  iso_3166_1?: string;
  file_path?: string;
  vote_average?: number;
};

function bestByVote<T extends { vote_average?: number }>(items: T[]) {
  return items.length
    ? items.sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))[0]
    : undefined;
}

async function enrichWithImages(
  items: Record<string, unknown>[],
  language: string,
  mediaType?: "movie" | "tv"
) {
  const [languageCode] = language.split("-");
  const preferredRegion =
    languageCode === "zh" ? (language.includes("TW") ? "TW" : "CN") : undefined;

  const enrichOne = async (item: Record<string, unknown>) => {
    try {
      const type = mediaType ?? (item.media_type as string);
      if (type !== "movie" && type !== "tv") return item;

      const id = item.id as number;
      const imagesResult =
        type === "tv"
          ? await tmdb.GET(`/3/tv/${id}/images`, {
              params: { path: { series_id: id } },
            })
          : await tmdb.GET(`/3/movie/${id}/images`, {
              params: { path: { movie_id: id } },
            });
      if (imagesResult.response.status !== 200) return item;

      const images = imagesResult.data;

      const logos = (images?.logos ?? []) as ImageEntry[];
      let logo: string | undefined;
      if (logos.length) {
        const regionMatches = preferredRegion
          ? logos.filter(
              (l) =>
                l.iso_639_1 === languageCode && l.iso_3166_1 === preferredRegion
            )
          : [];
        const langMatches = logos.filter((l) => l.iso_639_1 === languageCode);
        const best =
          bestByVote(regionMatches) ??
          bestByVote(langMatches) ??
          bestByVote(logos);
        logo = best?.file_path;
      }

      const posters = (images?.posters ?? []) as ImageEntry[];
      const noLogoPoster = bestByVote(
        posters.filter((p) => !p.iso_639_1)
      )?.file_path;

      const backdrops = (images?.backdrops ?? []) as ImageEntry[];
      const thumbnail =
        backdrops.find((b) => b.iso_639_1 === languageCode)?.file_path ||
        backdrops.find((b) => b.iso_639_1 === "en")?.file_path ||
        (item.backdrop_path as string | undefined) ||
        (item.poster_path as string | undefined);

      return { ...item, logo, noLogoPoster, thumbnail };
    } catch {
      return item;
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
    const top = results.slice(0, 10);
    const rest = results.slice(10);
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
    const enriched = await enrichWithImages(
      result.data.results as Record<string, unknown>[],
      language,
      "tv"
    );
    return c.json({ ...result.data, results: enriched });
  }
  return c.json(result.data);
});

tmdbApp.get("/discover/movie", async (c) => {
  const language = c.req.query("language") || "en";
  const page = Number.parseInt(c.req.query("page") || "1");
  const with_genres = c.req.query("with_genres");
  const without_genres = c.req.query("without_genres");
  const with_networks = c.req.query("with_networks");
  const with_original_language = c.req.query("with_original_language");
  const sortByQuery = c.req.query("sort_by");

  if (sortByQuery && !isValidMovieSortBy(sortByQuery)) {
    return c.json(
      {
        error: `Invalid sort_by value. Allowed values: ${VALID_MOVIE_SORT_BY_VALUES.join(
          ", "
        )}`,
      },
      400
    );
  }

  const sort_by = sortByQuery as MovieSortBy | undefined;
  const result = await tmdb.GET("/3/discover/movie", {
    params: {
      query: {
        language,
        page,
        sort_by,
        with_genres,
        without_genres,
        with_networks,
        with_original_language,
        "vote_average.lte": 10,
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
});

tmdbApp.get("/discover/tv", async (c) => {
  const language = c.req.query("language") || "en";
  const page = Number.parseInt(c.req.query("page") || "1");
  const with_genres = c.req.query("with_genres");
  const without_genres = c.req.query("without_genres");
  const with_networks_query = c.req.query("with_networks");
  const with_networks = with_networks_query
    ? Number.parseInt(with_networks_query)
    : undefined;
  const with_original_language = c.req.query("with_original_language") || "";
  const sortByQuery = c.req.query("sort_by");

  if (sortByQuery && !isValidTvSortBy(sortByQuery)) {
    return c.json(
      {
        error: `Invalid sort_by value. Allowed values: ${VALID_TV_SORT_BY_VALUES.join(
          ", "
        )}`,
      },
      400
    );
  }

  const sort_by = sortByQuery as TvSortBy | undefined;
  const result = await tmdb.GET("/3/discover/tv", {
    params: {
      query: {
        language,
        page,
        sort_by,
        with_genres,
        without_genres,
        with_networks,
        with_original_language,
        "vote_average.lte": 10,
      },
    },
  });
  if (result.response.status !== 200) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result.data);
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

  const cache = workersDefaultCache();
  const cacheRequest = new Request(c.req.url, { method: "GET" });
  if (cache) {
    const cached = await cache.match(cacheRequest);
    if (cached) {
      return cached;
    }
  }

  const imageUrl = new URL(path, "https://image.tmdb.org/t/p/").href;

  const onCf = cache !== undefined;
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

  const contentType = upstream.headers.get("content-type") || "image/jpeg";
  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": TMDB_IMAGE_CACHE_CONTROL,
  });

  const forCache = upstream.clone();
  const outgoing = new Response(upstream.body, { headers });

  if (cache && c.executionCtx) {
    const responseToStore = new Response(forCache.body, {
      headers: new Headers(headers),
    });
    c.executionCtx.waitUntil(cache.put(cacheRequest, responseToStore));
  }

  return outgoing;
});

export default tmdbApp;
